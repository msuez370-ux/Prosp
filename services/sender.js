const { genererMessages } = require('./claude');
const { envoyerEmail, envoyerSMS } = require('./brevo');
const { sauvegarderProspect } = require('./sheets');
const { ajouterJob } = require('./queue');

const DELAI_ENTRE_ENVOIS = 30 * 60 * 1000; // 30 minutes

async function envoyerSequence(prospects) {
  console.log(`📤 Début séquence — ${prospects.length} prospects`);

  for (let i = 0; i < prospects.length; i++) {
    const prospect = prospects[i];

    // Attendre 30 min entre chaque envoi (sauf le premier)
    if (i > 0) {
      const delai = i * DELAI_ENTRE_ENVOIS;
      const heure = new Date(Date.now() + delai).toLocaleTimeString('fr-FR');
      console.log(`⏰ Prospect ${i + 1} programmé pour ${heure}`);
      
      // Ajouter à la queue avec délai
      await ajouterJobEnvoi(prospect, delai);
    } else {
      // Premier envoi immédiat
      await envoyerProspect(prospect);
    }
  }
}

async function ajouterJobEnvoi(prospect, delaiMs) {
  const fs = require('fs');
  const QUEUE_FILE = './queue.json';
  const queue = fs.existsSync(QUEUE_FILE)
    ? JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'))
    : [];

  let executeAt = new Date(Date.now() + delaiMs);

  // Si l'heure calculée est hors plage → décaler au prochain jour ouvré à 08h30
  const heure = executeAt.getHours() + executeAt.getMinutes() / 60;
  const jour = executeAt.getDay();

  if (jour === 0 || heure < 8.5 || heure > 17.5) {
    // Trouver le prochain jour ouvré
    executeAt.setHours(8, 30, 0, 0);
    executeAt.setDate(executeAt.getDate() + 1);

    // Si c'est dimanche, passer au lundi
    while (executeAt.getDay() === 0) {
      executeAt.setDate(executeAt.getDate() + 1);
    }
  }

  queue.push({
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    type: 'email_prospect',
    prospect,
    executeAt: executeAt.toISOString(),
    statut: 'en_attente'
  });

  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  console.log(`📅 Email programmé pour ${executeAt.toLocaleString('fr-FR')}`);
}

async function envoyerProspect(prospect) {
  try {
    console.log(`\n📋 Envoi → ${prospect.nom} (${prospect.ville})`);

    // Formater pour Claude
    const prospectFormate = {
      nom: prospect.nom,
      email: prospect.email || '',
      tel: prospect.tel || '',
      ville: prospect.ville || prospect.adresse,
      secteur: prospect.secteur,
      note: prospect.note || 0,
      problemes: construireProblemes(prospect),
      notes: `Score priorité: ${prospect.score}/100. Source: ${prospect.source}.`,
      whatsapp: false
    };

    // Générer les messages
    const messages = await genererMessages(prospectFormate);

    // Envoyer email si disponible
    if (prospect.email) {
      await envoyerEmail(prospectFormate, messages.email_objet, messages.email_corps);
    }

    // Envoyer SMS si disponible (et email absent)
    if (prospect.tel && !prospect.email) {
      await envoyerSMS(prospectFormate, messages.sms);
    }

    // Programmer RVM si numéro dispo
    if (prospect.tel) {
      const { ajouterJob } = require('./queue');
      ajouterJob('rvm', prospectFormate, messages, 360);
    }

    // Sauvegarder dans Sheets
    await sauvegarderProspect(prospectFormate, messages);

    console.log(`✅ ${prospect.nom} — envoyé avec succès`);
    return true;

  } catch (err) {
    console.error(`❌ Erreur ${prospect.nom}:`, err.message);
    return false;
  }
}

function construireProblemes(prospect) {
  const problemes = [];
  if (!prospect.site) problemes.push('Pas de site web');
  if (prospect.note && prospect.note < 3.5) problemes.push('Mauvais avis en premier');
  if (prospect.nombre_avis < 10) problemes.push('Peu d\'avis Google');
  return problemes;
}

module.exports = { envoyerSequence, envoyerProspect };