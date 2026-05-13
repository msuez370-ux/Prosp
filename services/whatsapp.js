const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function envoyerWhatsApp(prospect, message) {
  if (!prospect.tel) return null;

  let tel = prospect.tel.replace(/\s/g, '');
  if (tel.startsWith('0')) tel = '+33' + tel.slice(1);

  await client.messages.create({
    from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
    to: 'whatsapp:' + tel,
    body: message
  });

  console.log(`✅ WhatsApp envoyé à ${tel}`);
}

module.exports = { envoyerWhatsApp };