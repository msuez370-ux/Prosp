const { genererMessages } = require('./claude');
const { envoyerEmail } = require('./brevo');
const { sauvegarderProspect } = require('./sheets');

const DELAI_ENTRE_ENVOIS = 30 * 60 * 1000; // 30 minutes

async function envoyerSequence(prospects) {
  console.log(`📤 Début séquence — ${prospects.length} prospects`);

  // Premier envoi immédiat
  await envoyerProspect(prospects[0]);

  // Reste programmé avec délai
  for (let i = 1; i < prospects.length; i++) {
    await ajouterJobEnvoi(prospects[i], i * DELAI_ENTRE_ENVOIS);
  }
}

async function ajouterJobEnvoi(prospect, delaiMs) {
  const fs = require('fs');
  const QUEUE_FILE = './queue.json';
  const queue = fs.existsSync(QUEUE_FILE)
    ? JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'))
    : [];

  let executeAt = new Date(Date.now() + delaiMs);

  const heure = executeAt.getHours() + executeAt.getMinutes() / 60;
  const jour = executeAt.getDay();

  if (jour === 0 || heure < 8.5 || heure > 17.5) {
    executeAt.setHours(8, 30, 0, 0);
    executeAt.setDate(executeAt.getDate() + 1);
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

  const fs2 = require('fs');
  fs2.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  console.log(`📅 Email programmé pour ${executeAt.toLocaleString('fr-FR')}`);
}

async function envoyerProspect(prospect) {
  try {
    console.log(`\n📋 Envoi → ${prospect.nom} (${prospect.ville || prospect.adresse})`);

    const prospectFormate = {
      nom: prospect.nom,
      email: prospect.email || '',
      tel: prospect.tel || '',
      ville: prospect.ville || prospect.adresse || '',
      secteur: prospect.secteur,
      note: prospect.note || 0,
      problemes: construireProblemes(prospect),
      // ← CRITIQUE : passe le nom du client à Claude
      notes: `Client: ${prospect.client || 'IKREET'}. Score: ${prospect.score || 0}/100.`,
      whatsapp: false
    };

    const messages = await genererMessages(prospectFormate);

    if (prospect.email) {
      await envoyerEmail(prospectFormate, messages.email_objet, messages.email_corps);
    }

    // SMS désactivé
    // if (prospect.tel && !prospect.email) {
    //   await envoyerSMS(prospectFormate, messages.sms);
    // }

    if (prospect.tel) {
      const { ajouterJob } = require('./queue');
      ajouterJob('rvm', prospectFormate, messages, 360);
    }

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