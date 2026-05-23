const cron = require('node-cron');
const { getJobsAExecuter, marquerJobFait } = require('./queue');
const { envoyerWhatsApp } = require('./whatsapp');
const { genererAudio } = require('./polly');
const { envoyerRVM } = require('./rvm');

function estHeureAutorisee() {
  const now = new Date();
  const jour = now.getDay();
  const heure = now.getHours() + now.getMinutes() / 60;
  if (jour === 0) return false;
  if (heure < 8.5 || heure > 17.5) return false;
  return true;
}

function demarrerCron() {
  cron.schedule('*/10 * * * *', async () => {
    if (!estHeureAutorisee()) return;

    try {
      const jobs = await getJobsAExecuter();
      if (jobs.length === 0) return;

      console.log(`\n⏰ Cron — ${jobs.length} job(s) à exécuter`);

      for (const job of jobs) {
        try {
          if (job.type === 'whatsapp') {
            await envoyerWhatsApp(job.prospect, job.messages.whatsapp);
          }

          if (job.type === 'rvm') {
            const audioUrl = await genererAudio(job.messages.vocal, `rvm_${job.id}`);
            await envoyerRVM(job.prospect, audioUrl);
          }

          await marquerJobFait(job.index);
          console.log(`✅ Job ${job.type} exécuté pour ${job.prospect.nom}`);

        } catch (err) {
          console.error(`❌ Job ${job.type} échoué :`, err.message);
        }
      }
    } catch (err) {
      console.error('❌ Erreur cron:', err.message);
    }
  });

  console.log('⏰ Cron démarré — 08h30-17h30, lun-sam');
}

module.exports = { demarrerCron };