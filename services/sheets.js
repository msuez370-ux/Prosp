const { google } = require('googleapis');

async function sauvegarderProspect(prospect, messages) {
  let credentials;
  
  try {
    credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_CREDENTIALS_B64, 'base64').toString('utf8')
    );
  } catch(e) {
    throw new Error('Impossible de décoder GOOGLE_CREDENTIALS_B64 : ' + e.message);
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const now = new Date().toLocaleString('fr-FR');

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Prospects!A:L',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        now,
        prospect.nom,
        prospect.secteur,
        prospect.ville,
        prospect.email || '',
        prospect.tel || '',
        prospect.note ? `${prospect.note}/5` : '',
        (prospect.problemes || []).join(', '),
        messages.email_objet,
        messages.email_corps,
        messages.sms || '',
        'Envoyé'
      ]]
    }
  });

  console.log(`✅ Prospect "${prospect.nom}" sauvegardé dans Sheets`);
}

module.exports = { sauvegarderProspect };