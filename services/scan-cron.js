const cron = require('node-cron');
const { getJobsAExecuter, marquerJobFait } = require('./queue');
const { envoyerProspect } = require('./sender');

function estHeureAutorisee() {
  const now = new Date();
  const jour = now.getDay();
  const heure = now.getHours() + now.getMinutes() / 60;
  if (jour === 0) return false;
  if (heure < 8.5 || heure > 17.5) return false;
  return true;
}

function demarrerScanCron() {
  cron.schedule('*/5 * * * *', async () => {
    if (!estHeureAutorisee()) return;

    try {
      const jobs = await getJobsAExecuter();
      const emailJobs = jobs.filter(j => j.type === 'email_prospect');
      if (emailJobs.length === 0) return;

      console.log(`\n⏰ ${new Date().toLocaleTimeString('fr-FR')} — ${emailJobs.length} email(s) à envoyer`);

      // Envoyer UN seul email par cycle de 5 min
      const job = emailJobs[0];
      await envoyerProspect(job.prospect);
      await marquerJobFait(job.index);

    } catch (err) {
      console.error('❌ Erreur scan-cron:', err.message);
    }
  });

  console.log('⏰ Scan-cron démarré — 08h30-17h30, lun-sam');
}

module.exports = { demarrerScanCron };