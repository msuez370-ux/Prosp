const axios = require('axios');

const HEADERS = {
  'api-key': process.env.BREVO_API_KEY,
  'Content-Type': 'application/json'
};

async function envoyerEmail(prospect, emailObjet, emailCorps) {
  if (!prospect.email) return null;

  await axios.post('https://api.brevo.com/v3/smtp/email', {
    sender: { name: 'IKREET', email: process.env.BREVO_EMAIL_SENDER },
    to: [{ email: prospect.email, name: prospect.nom }],
    subject: emailObjet,
    textContent: emailCorps
  }, { headers: HEADERS });

  console.log(`✅ Email envoyé à ${prospect.email}`);
}

async function envoyerSMS(prospect, sms) {
  if (!prospect.tel) return null;

  // Formatage numéro FR → international
  let tel = prospect.tel.replace(/\s/g, '');
  if (tel.startsWith('0')) tel = '+33' + tel.slice(1);

  await axios.post('https://api.brevo.com/v3/transactionalSMS/sms', {
    sender: process.env.BREVO_SMS_SENDER,
    recipient: tel,
    content: sms
  }, { headers: HEADERS });

  console.log(`✅ SMS envoyé à ${tel}`);
}

module.exports = { envoyerEmail, envoyerSMS };