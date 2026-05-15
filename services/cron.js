const cron = require('node-cron');
const { getJobsAExecuter, marquerJobFait } = require('./queue');
const { envoyerWhatsApp } = require('./whatsapp');
const { genererAudio } = require('./polly');
const { envoyerRVM } = require('./rvm');

function demarrerCron() {
  cron.schedule('*/10 * * * *', async () => {
    const jobs = getJobsAExecuter();
    if (jobs.length === 0) return;

    console.log(`\n⏰ Cron — ${jobs.length} job(s) à exécuter`);

    for (const job of jobs) {
      try {
        if (job.type === 'whatsapp') {
          await envoyerWhatsApp(job.prospect, job.messages.whatsapp);
        }

        if (job.type === 'rvm') {
  // genererAudio retourne directement l'URL S3
  const audioUrl = await genererAudio(job.messages.vocal, `rvm_${job.id}`);
  await envoyerRVM(job.prospect, audioUrl);
}

        marquerJobFait(job.id);
        console.log(`✅ Job ${job.type} exécuté pour ${job.prospect.nom}`);

      } catch (err) {
        console.error(`❌ Job ${job.type} échoué :`, err.message);
      }
    }
  });

  console.log('⏰ Cron démarré — vérification toutes les 10 min');
}

module.exports = { demarrerCron };