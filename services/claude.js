const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
async function genererMessages(prospect) {
  const { nom, secteur, ville, note, problemes, notes } = prospect;
  const problemesTxt = problemes?.length ? `Problèmes repérés : ${problemes.join(', ')}.` : '';

  // Détecter le client depuis les notes
  const clientMatch = notes && notes.match(/Client: ([^.]+)/);
  const nomClient = clientMatch ? clientMatch[1].trim() : 'IKREET';
  const isIkreet = nomClient === 'IKREET';

  // Description adaptée selon le client
  const descriptionClient = isIkreet
    ? "IKREET : agence qui crée des sites web professionnels pour les commerces locaux et améliore leur réputation en ligne."
    : `${nomClient} : service de collecte et livraison de courrier professionnel à domicile pour les entreprises. Passe régulier, gain de temps, confidentialité assurée. Offres à partir de 8€/collecte ou 79€/mois.`;

  const signatureClient = isIkreet
    ? "Mohamed Boussari — IKREET\nTél : 07 48 33 84 43\nEmail : contact@mohamed-boussari.fr"
    : "Salah TLIBA — Speedcourse\nTél : 06 67 22 06 21\nEmail : speedcourse13600@hotmail.com";

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `Génère des messages de prospection pour ce commerce.
Nom : ${nom} | Secteur : ${secteur} | Ville : ${ville} | Note Google : ${note}/5 | Problèmes : ${problemesTxt || 'Aucun'} | Notes : ${notes || 'Aucune'}

Entreprise qui prospecte : ${descriptionClient}

Règles strictes :
- Ton chaleureux, direct, jamais agressif
- Mentionne spécifiquement le problème repéré
- Email : 5-7 lignes max, objet inclus
- SMS : max 160 caractères
- WhatsApp : 3-5 lignes, décontracté, 1 emoji max
- Vocal : 60-80 mots MAXIMUM, commence OBLIGATOIREMENT par "Bonjour, je suis l'assistant vocal de ${nomClient}.", mentionne le commerce et le problème repéré, demande un rappel au ${process.env.TWILIO_PHONE_NUMBER}, termine par "Bonne journée !"
- Signature email : ${signatureClient}
- Ne jamais mentionner d'autres entreprises que ${nomClient}

IMPORTANT : réponds uniquement avec le JSON ci-dessous, sans backticks :
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