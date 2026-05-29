// services/onboarding.js
// Génère un espace client complet en 1 clic

const { google } = require('googleapis');
const crypto = require('crypto');
const { envoyerEmail } = require('./brevo');

function getAuth() {
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS_B64, 'base64').toString('utf8')
  );
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
  });
}

async function creerGoogleSheet(nomClient) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  // Créer un nouveau Google Sheet
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `IKREET — Prospects ${nomClient}` },
      sheets: [
        {
          properties: { title: 'Prospects', sheetId: 0 },
          data: [{
            startRow: 0, startColumn: 0,
            rowData: [{
              values: [
                'Date', 'Nom', 'Secteur', 'Ville', 'Email', 'Téléphone',
                'Note', 'Problèmes', 'Email Objet', 'Email Corps', 'SMS', 'Statut'
              ].map(v => ({ userEnteredValue: { stringValue: v } }))
            }]
          }]
        },
        { properties: { title: 'Queue', sheetId: 1 } }
      ]
    }
  });

  const sheetId = spreadsheet.data.spreadsheetId;

  // Partager avec le service account
  await drive.permissions.create({
    fileId: sheetId,
    requestBody: { role: 'writer', type: 'anyone' }
  });

  return sheetId;
}

async function genererClient(infos) {
  const {
    nom, prenom, email, tel, entreprise, secteurActivite
  } = infos;

  // 1. Générer APP_SECRET unique
  const secret = `ikreet-${entreprise.toLowerCase().replace(/\s/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;

  // 2. Créer Google Sheet dédié
  console.log('📊 Création Google Sheet...');
  const sheetId = await creerGoogleSheet(entreprise);

  // 3. Générer URL client
  const clientSlug = entreprise.toLowerCase().replace(/\s/g, '-').replace(/[^a-z0-9-]/g, '');
  const clientUrl = `${process.env.BASE_URL}?client=${clientSlug}&key=${secret}`;

  // 4. Construire la config client
  const config = {
    nom: `${prenom} ${nom}`,
    entreprise,
    email,
    tel,
    secteurActivite,
    secret,
    sheetId,
    clientUrl,
    dateCreation: new Date().toLocaleString('fr-FR'),
  };

  // 5. Envoyer email de bienvenue
  console.log('📧 Envoi email de bienvenue...');
  await envoyerEmailBienvenue(config);

  // 6. Sauvegarder dans Google Sheet principal (onglet Clients)
  await sauvegarderClient(config);

  return config;
}

async function envoyerEmailBienvenue(config) {
  const { envoyerEmail } = require('./brevo');

  const prospect = {
    email: config.email,
    nom: config.entreprise
  };

  const objet = `Bienvenue sur IKREET — Vos accès ${config.entreprise}`;

  const corps = `Bonjour ${config.prenom || config.nom},

Votre espace IKREET est prêt ! Voici vos accès :

🔗 Votre lien de prospection :
${config.clientUrl}

📊 Votre tableau de suivi (Google Sheets) :
https://docs.google.com/spreadsheets/d/${config.sheetId}

---

COMMENT UTILISER IKREET :

1. Ouvrez votre lien sur votre téléphone
2. Repérez une entreprise à prospecter
3. Remplissez le formulaire en 30 secondes
4. Le système envoie automatiquement un email personnalisé
5. Suivez vos prospects dans Google Sheets

---

Votre système prospecte automatiquement des entreprises pour votre service Collecte Premium. Les emails sont envoyés entre 08h30 et 17h30, du lundi au samedi.

En cas de question : contact@mohamed-boussari.fr ou 07 48 33 84 43

Bonne prospection !
Mohamed Boussari — IKREET`;

  await envoyerEmail(prospect, objet, corps);
}

async function sauvegarderClient(config) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Clients!A:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          config.dateCreation,
          config.entreprise,
          config.nom,
          config.email,
          config.tel,
          config.secret,
          config.sheetId,
          config.clientUrl
        ]]
      }
    });
  } catch {
    // Onglet Clients n'existe pas encore — pas critique
    console.log('⚠️ Onglet Clients non trouvé — créez-le dans votre Google Sheet principal');
  }
}

module.exports = { genererClient };