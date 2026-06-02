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
const { envoyerRVM, callAudioMap } = require('./services/rvm');
const { scannerVille } = require('./services/scraper');
const { envoyerSequence } = require('./services/sender');
const { demarrerScanCron } = require('./services/scan-cron');
const { genererClient } = require('./services/onboarding');

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

// ── Utilitaire : nom client depuis clé API ──
function getNomClient(authHeader, isAdmin) {
  if (isAdmin) return 'IKREET';
  // Format clé : ikreet-speedcourse-xxxx → "Speedcourse"
  const parts = authHeader.split('-');
  if (parts.length >= 2) {
    return parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
  }
  return 'Client';
}

// ── Route formulaire manuel ──
app.post('/prospect', async (req, res) => {
  const authHeader = req.headers['x-api-key'];
  if (authHeader !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const { nom, email, tel } = req.body;
  if (!nom || nom.length < 2) return res.status(400).json({ error: 'Nom invalide' });
  if (!email && !tel) return res.status(400).json({ error: 'Email ou téléphone requis' });
  if (email && !email.includes('@')) return res.status(400).json({ error: 'Email invalide' });

  const prospect = req.body;
  prospect.client = 'IKREET';

  console.log(`\n📋 Nouveau prospect : ${prospect.nom} — ${prospect.ville}`);

  try {
    console.log('🤖 Génération des messages...');
    const messages = await genererMessages(prospect);
    console.log('✅ Messages générés');

    await envoyerEmail(prospect, messages.email_objet, messages.email_corps);

    // SMS désactivé
    // await envoyerSMS(prospect, messages.sms);

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

    await sauvegarderProspect(prospect, messages);
    res.json({ success: true, messages });

  } catch (err) {
    console.error('❌ Erreur :', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Route TwiML ──
app.get('/twiml/rvm', (req, res) => {
  const twiml = new VoiceResponse();
  twiml.pause({ length: 45 });
  res.type('text/xml');
  res.send(twiml.toString());
});

// ── Callback AMD ──
app.post('/twiml/amd-callback', async (req, res) => {
  const { AnsweredBy, CallSid } = req.body;
  console.log(`📞 AMD — ${CallSid} — ${AnsweredBy}`);

  const twiml = new VoiceResponse();
  const audioUrl = callAudioMap[CallSid];

  if (
    AnsweredBy === 'machine_end_beep' ||
    AnsweredBy === 'machine_end_silence' ||
    AnsweredBy === 'machine_end_other'
  ) {
    console.log(`📱 Messagerie détectée — dépôt du message vocal`);
    if (audioUrl) twiml.play(audioUrl);
    twiml.hangup();
  } else {
    console.log(`👤 ${AnsweredBy} — raccrocher`);
    twiml.hangup();
  }

  delete callAudioMap[CallSid];
  res.type('text/xml');
  res.send(twiml.toString());
});

// ── Route scan automatique ──
app.post('/scan', async (req, res) => {
  const authHeader = req.headers['x-api-key'];
  const isAdmin = authHeader === process.env.APP_SECRET;
  const isClient = authHeader && authHeader.startsWith('ikreet-');

  if (!isAdmin && !isClient) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const { ville, secteur, rayon } = req.body;
  if (!ville || !secteur) {
    return res.status(400).json({ error: 'Ville et secteur requis' });
  }

  const nomClient = getNomClient(authHeader, isAdmin);
  console.log(`🔍 Scan lancé — Client: ${nomClient} — ${secteur} à ${ville}`);

  res.json({ success: true, message: `Scan lancé pour ${secteur} à ${ville}` });

  try {
    const prospects = await scannerVille(ville, secteur, rayon || 5000);

    prospects.forEach(p => {
      p.secteur = secteur;
      p.client = nomClient;
    });

    await envoyerSequence(prospects);
    console.log(`✅ Scan terminé — ${prospects.length} prospects — Client: ${nomClient}`);

  } catch (err) {
    console.error('❌ Erreur scan:', err.message);
  }
});

// ── Route onboarding client ──
app.post('/admin/generer-client', async (req, res) => {
  const authHeader = req.headers['x-api-key'];
  if (authHeader !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  try {
    const config = await genererClient(req.body);
    console.log(`✅ Client généré : ${config.entreprise}`);
    res.json({ success: true, config });
  } catch (err) {
    console.error('❌ Erreur onboarding:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Démarrer les crons ──
demarrerCron();
demarrerScanCron();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 IKREET Backend lancé sur http://localhost:${PORT}`);
  console.log(`🌍 URL publique : ${process.env.BASE_URL}`);
});