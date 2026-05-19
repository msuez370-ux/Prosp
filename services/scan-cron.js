const cron = require('node-cron');
const fs = require('fs');
const { envoyerProspect } = require('./sender');

function estHeureAutorisee() {
  const now = new Date();
  const jour = now.getDay(); // 0 = dimanche, 6 = samedi
  const heure = now.getHours();
  const minutes = now.getMinutes();
  const heureDecimale = heure + minutes / 60;

  // Pas le dimanche
  if (jour === 0) return false;

  // Entre 08h30 et 17h30
  if (heureDecimale < 8.5 || heureDecimale > 17.5) return false;

  return true;
}

function demarrerScanCron() {
  // Vérifie toutes les 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    // Vérifier si on est dans la plage horaire autorisée
    if (!estHeureAutorisee()) return;

    const QUEUE_FILE = './queue.json';
    if (!fs.existsSync(QUEUE_FILE)) return;

    const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    const maintenant = new Date().toISOString();

    const aFaire = queue.filter(j =>
      j.type === 'email_prospect' &&
      j.statut === 'en_attente' &&
      j.executeAt <= maintenant
    );

    if (aFaire.length === 0) return;

    console.log(`\n⏰ ${new Date().toLocaleTimeString('fr-FR')} — ${aFaire.length} email(s) à envoyer`);

    for (const job of aFaire) {
      await envoyerProspect(job.prospect);
      job.statut = 'fait';
    }

    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  });

  console.log('⏰ Scan-cron démarré — envois 08h30-17h30, lun-sam');
}

module.exports = { demarrerScanCron };