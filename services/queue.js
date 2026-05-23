const { google } = require('googleapis');
const fs = require('fs');

function getAuth() {
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS_B64, 'base64').toString('utf8')
  );
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

async function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

async function ajouterJob(type, prospect, messages, delaiMinutes) {
  const sheets = await getSheets();
  const executeAt = new Date(Date.now() + delaiMinutes * 60 * 1000).toISOString();

  // Décaler si hors plage horaire
  const date = new Date(executeAt);
  const heure = date.getHours() + date.getMinutes() / 60;
  const jour = date.getDay();

  if (jour === 0 || heure < 8.5 || heure > 17.5) {
    date.setHours(8, 30, 0, 0);
    date.setDate(date.getDate() + 1);
    while (date.getDay() === 0) date.setDate(date.getDate() + 1);
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Queue!A:F',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        Date.now().toString(),
        type,
        JSON.stringify(prospect),
        JSON.stringify(messages || {}),
        date.toISOString(),
        'en_attente'
      ]]
    }
  });

  console.log(`📅 Job ${type} programmé pour ${date.toLocaleString('fr-FR')}`);
}

async function getJobsAExecuter() {
  const sheets = await getSheets();
  const maintenant = new Date().toISOString();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Queue!A:F'
  });

  const rows = res.data.values || [];
  return rows
    .map((row, index) => ({
      index: index + 1,
      id: row[0],
      type: row[1],
      prospect: JSON.parse(row[2] || '{}'),
      messages: JSON.parse(row[3] || '{}'),
      executeAt: row[4],
      statut: row[5]
    }))
    .filter(j => j.statut === 'en_attente' && j.executeAt <= maintenant);
}

async function marquerJobFait(index) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Queue!F${index + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['fait']] }
  });
}

// Compatibilité avec l'ancien code local (fallback)
function lireQueue() {
  try {
    if (fs.existsSync('./queue.json')) {
      return JSON.parse(fs.readFileSync('./queue.json', 'utf8'));
    }
  } catch {}
  return [];
}

module.exports = { ajouterJob, getJobsAExecuter, marquerJobFait, lireQueue };