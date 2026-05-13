const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '../queue.json');

function lireQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
}

function sauvegarderQueue(jobs) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(jobs, null, 2));
}

function ajouterJob(type, prospect, messages, delaiMinutes) {
  const queue = lireQueue();
  const executeAt = new Date(Date.now() + delaiMinutes * 60 * 1000).toISOString();
  queue.push({
    id: Date.now().toString(),
    type,
    prospect,
    messages,
    executeAt,
    statut: 'en_attente'
  });
  sauvegarderQueue(queue);
  console.log(`📅 Job ${type} programmé pour dans ${delaiMinutes} min`);
}

function getJobsAExecuter() {
  const queue = lireQueue();
  const maintenant = new Date().toISOString();
  return queue.filter(j => j.statut === 'en_attente' && j.executeAt <= maintenant);
}

function marquerJobFait(id) {
  const queue = lireQueue();
  const job = queue.find(j => j.id === id);
  if (job) job.statut = 'fait';
  sauvegarderQueue(queue);
}

module.exports = { ajouterJob, getJobsAExecuter, marquerJobFait };