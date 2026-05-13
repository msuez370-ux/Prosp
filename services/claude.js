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

IMPORTANT : réponds uniquement avec le JSON ci-dessous, remplace les "..." par le contenu, sans aucun texte avant ou après, sans backticks :
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