const cron = require('node-cron');
const fs = require('fs');
const { envoyerProspect } = require('./sender');

function demarrerScanCron() {
  // Vérifie toutes les 5 minutes les emails en attente
  cron.schedule('*/5 * * * *', async () => {
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

    console.log(`\n⏰ Scan-cron — ${aFaire.length} email(s) à envoyer`);

    for (const job of aFaire) {
      await envoyerProspect(job.prospect);
      job.statut = 'fait';
    }

    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  });

  console.log('⏰ Scan-cron démarré — envois espacés toutes les 30 min');
}

module.exports = { demarrerScanCron };