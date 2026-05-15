const twilio = require('twilio');
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Map partagée CallSid → audioUrl
const callAudioMap = {};

async function envoyerRVM(prospect, audioUrl) {
  if (!prospect.tel) return null;

  let tel = prospect.tel.replace(/\s/g, '');
  if (tel.startsWith('0')) tel = '+33' + tel.slice(1);

  const call = await client.calls.create({
    to: tel,
    from: process.env.TWILIO_PHONE_NUMBER,
    url: `${process.env.BASE_URL}/twiml/rvm`,
    machineDetection: 'DetectMessageEnd',
    machineDetectionTimeout: 45,
    machineDetectionSpeechThreshold: 2400,
    machineDetectionSpeechEndThreshold: 1200,
    machineDetectionSilenceTimeout: 5000,
    asyncAmd: 'true',
    asyncAmdStatusCallback: `${process.env.BASE_URL}/twiml/amd-callback`,
    asyncAmdStatusCallbackMethod: 'POST',
  });

  // Associe le CallSid à l'URL audio
  callAudioMap[call.sid] = audioUrl;
  console.log(`✅ Appel RVM initié : ${call.sid}`);
  return call.sid;
}

module.exports = { envoyerRVM, callAudioMap };