const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function genererMessages(prospect) {
  const { nom, secteur, ville, note, problemes, notes } = prospect;
  const problemesTxt = problemes?.length ? `Problèmes repérés : ${problemes.join(', ')}.` : '';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `Génère des messages de prospection pour ce commerce.
Nom : ${nom} | Secteur : ${secteur} | Ville : ${ville} | Note Google : ${note}/5 | Problèmes : ${problemesTxt || 'Aucun'} | Notes : ${notes || 'Aucune'}
Agence IKREET : crée des sites web et améliore la réputation en ligne des commerces locaux.

Règles strictes :
- Email : 5-7 lignes, percutant, mentionne le problème repéré, termine par une invitation à répondre
- SMS : max 160 caractères, direct, mentionne IKREET
- WhatsApp : 3-5 lignes, décontracté, 1 emoji max, mentionne le problème
- Vocal : 60-80 mots MAXIMUM, commence OBLIGATOIREMENT par "Bonjour, je suis l'assistant vocal de l'agence IKREET.", mentionne le commerce et le problème repéré, demande un rappel au ${process.env.TWILIO_PHONE_NUMBER}, termine par "Bonne journée !", ton naturel et humain, pas robotique

IMPORTANT : réponds uniquement avec le JSON ci-dessous, sans aucun texte avant ou après, sans backticks :
{"email_objet":"...","email_corps":"...","sms":"...","whatsapp":"...","vocal":"..."}`
    }]
  });

  const text = response.content[0].text.trim();
  console.log('RAW Claude:', text.substring(0, 150));

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1) {
    throw new Error('Claude na pas renvoyé de JSON valide : ' + text.substring(0, 200));
  }

  const clean = text.slice(start, end + 1);
  return JSON.parse(clean);
}

module.exports = { genererMessages };