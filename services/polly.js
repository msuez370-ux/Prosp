const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const polly = new PollyClient({
  region: 'eu-west-1', // Région fixe pour Polly (supporte Léa neural)
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const s3 = new S3Client({
  region: 'eu-north-1', // Région de ton bucket S3
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const BUCKET = 'ikreet-audio';

async function genererAudio(texte, nomFichier) {
  // 1. Générer l'audio avec Polly
  const command = new SynthesizeSpeechCommand({
    Text: texte,
    OutputFormat: 'mp3',
    VoiceId: 'Lea',
    LanguageCode: 'fr-FR',
    Engine: 'neural'
  });

  const response = await polly.send(command);

  // 2. Convertir le stream en buffer
  const chunks = [];
  for await (const chunk of response.AudioStream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  // 3. Sauvegarder localement (backup)
  const localPath = path.join(__dirname, '../audio', `${nomFichier}.mp3`);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);

  // 4. Uploader sur S3
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `${nomFichier}.mp3`,
    Body: buffer,
    ContentType: 'audio/mpeg',
  }));

  // 5. Retourner l'URL publique S3
  const url = `https://${BUCKET}.s3.eu-north-1.amazonaws.com/${nomFichier}.mp3`;
  console.log(`✅ Audio uploadé sur S3 : ${url}`);
  return url;
}

module.exports = { genererAudio };