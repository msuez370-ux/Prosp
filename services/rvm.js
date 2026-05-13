const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function envoyerRVM(prospect, audioUrl) {
  if (!prospect.tel) return null;

  let tel = prospect.tel.replace(/\s/g, '');
  if (tel.startsWith('0')) tel = '+33' + tel.slice(1);

  const call = await client.calls.create({
    to: tel,
    from: process.env.TWILIO_PHONE_NUMBER,
    url: `${process.env.BASE_URL}/twiml/rvm?audio=${encodeURIComponent(audioUrl)}`,
    machineDetection: 'DetectMessageEnd',
    asyncAmd: 'true',
    asyncAmdStatusCallback: `${process.env.BASE_URL}/twiml/amd-callback`,
  });

  console.log(`✅ Appel RVM initié : ${call.sid}`);
  return call.sid;
}

module.exports = { envoyerRVM };