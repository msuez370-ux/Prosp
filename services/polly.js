const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const fs = require('fs');
const path = require('path');

const polly = new PollyClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

async function genererAudio(texte, nomFichier) {
  const command = new SynthesizeSpeechCommand({
    Text: texte,
    OutputFormat: 'mp3',
    VoiceId: 'Lea',
    LanguageCode: 'fr-FR',
    Engine: 'neural'
  });

  const response = await polly.send(command);

  const chunks = [];
  for await (const chunk of response.AudioStream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  const filePath = path.join(__dirname, '../audio', `${nomFichier}.mp3`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);

  console.log(`✅ Audio généré : ${nomFichier}.mp3`);
  return filePath;
}

module.exports = { genererAudio };