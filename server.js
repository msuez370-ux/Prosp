require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const VoiceResponse = require('twilio').twiml.VoiceResponse;

const { genererMessages } = require('./services/claude');
const { envoyerEmail } = require('./services/brevo');
const { envoyerWhatsApp } = require('./services/whatsapp');
const { sauvegarderProspect } = require('./services/sheets');
const { ajouterJob } = require('./services/queue');
const { demarrerCron } = require('./services/cron');

const app = express();

// ── Sécurité ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de requêtes, réessaie dans 15 minutes' }
});
app.use('/prospect', limiter);

// ── Fichiers statiques ──
app.use(express.static('.'));
app.use('/audio', express.static(path.join(__dirname, 'audio')));

// ── Route principale ──
app.post('/prospect', async (req, res) => {

  // Authentification
  const authHeader = req.headers['x-api-key'];
  if (authHeader !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // Validation
  const { nom, email, tel } = req.body;
  if (!nom || nom.length < 2) {
    return res.status(400).json({ error: 'Nom invalide' });
  }
  if (!email && !tel) {
    return res.status(400).json({ error: 'Email ou téléphone requis' });
  }
  if (email && !email.includes('@')) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  const prospect = req.body;
  console.log(`\n📋 Nouveau prospect : ${prospect.nom} — ${prospect.ville}`);

  try {
    // 1. Générer tous les messages
    console.log('🤖 Génération des messages...');
    const messages = await genererMessages(prospect);
    console.log('✅ Messages générés');

    // 2. Email immédiatement
    await envoyerEmail(prospect, messages.email_objet, messages.email_corps);

    // 3. SMS désactivé (plan Brevo gratuit)
    // await envoyerSMS(prospect, messages.sms);

    // 4. WhatsApp ou RVM selon disponibilité
    if (prospect.tel) {
      if (prospect.whatsapp) {
        ajouterJob('whatsapp', prospect, messages, 360);
        ajouterJob('rvm', prospect, messages, 1440);
        console.log('📅 WhatsApp dans 6h — RVM dans 24h');
      } else {
        ajouterJob('rvm', prospect, messages, 360);
        console.log('📅 RVM dans 6h');
      }
    }

    // 5. Sauvegarder dans Google Sheets
    await sauvegarderProspect(prospect, messages);

    res.json({ success: true, messages });

  } catch (err) {
    console.error('❌ Erreur :', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Routes TwiML ──
app.get('/twiml/rvm', (req, res) => {
  const twiml = new VoiceResponse();
  twiml.play(req.query.audio);
  twiml.hangup();
  res.type('text/xml');
  res.send(twiml.toString());
});

app.post('/twiml/amd-callback', (req, res) => {
  console.log(`📞 AMD — répondu par : ${req.body.AnsweredBy}`);
  res.sendStatus(200);
});

// ── Démarrer le cron ──
demarrerCron();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 IKREET Backend lancé sur http://localhost:${PORT}`);
  console.log(`🌍 URL publique : ${process.env.BASE_URL}`);
});