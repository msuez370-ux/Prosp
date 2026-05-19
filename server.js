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

// ── Route TwiML — Twilio appelle cette URL au début de l'appel ──
app.get('/twiml/rvm', (req, res) => {
  const twiml = new VoiceResponse();
  twiml.pause({ length: 45 }); // Silence pendant que AMD analyse
  res.type('text/xml');
  res.send(twiml.toString());
});

// ── Callback AMD — Twilio nous dit si c'est humain ou messagerie ──
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
    if (audioUrl) {
      twiml.play(audioUrl);
    } else {
      console.log('⚠️ Pas d\'URL audio trouvée pour ce CallSid');
    }
    twiml.hangup();
  } else if (AnsweredBy === 'human') {
    console.log(`👤 Humain a décroché — raccrocher`);
    twiml.hangup();
  } else {
    console.log(`❓ AMD inconnu : ${AnsweredBy} — raccrocher`);
    twiml.hangup();
  }
  // ── Route scan automatique ──
app.post('/scan', async (req, res) => {
  const authHeader = req.headers['x-api-key'];
  if (authHeader !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const { ville, secteur, rayon } = req.body;

  if (!ville || !secteur) {
    return res.status(400).json({ error: 'Ville et secteur requis' });
  }

  // Répondre immédiatement — le scan tourne en arrière-plan
  res.json({ success: true, message: `Scan lancé pour ${secteur} à ${ville}` });

  // Lancer le scan en arrière-plan
  try {
    const prospects = await scannerVille(ville, secteur, rayon || 5000);
    
    // Ajouter le secteur à chaque prospect
    prospects.forEach(p => p.secteur = secteur);
    
    // Lancer l'envoi espacé
    await envoyerSequence(prospects);
    
    console.log(`✅ Scan terminé — ${prospects.length} prospects en cours d'envoi`);
  } catch (err) {
    console.error('❌ Erreur scan:', err.message);
  }
});
  // Nettoyage mémoire
  delete callAudioMap[CallSid];

  res.type('text/xml');
  res.send(twiml.toString());
});

// ── Démarrer le cron ──
demarrerCron();
demarrerScanCron();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 IKREET Backend lancé sur http://localhost:${PORT}`);
  console.log(`🌍 URL publique : ${process.env.BASE_URL}`);
});