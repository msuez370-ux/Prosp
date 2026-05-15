const { google } = require('googleapis');

async function sauvegarderProspect(prospect, messages) {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );

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
        messages.sms,
        'Envoyé'
      ]]
    }
  });

  console.log(`✅ Prospect "${prospect.nom}" sauvegardé dans Sheets`);
}

module.exports = { sauvegarderProspect };