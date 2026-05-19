const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

// ── Google Maps Places API ──
async function chercherSurGoogleMaps(ville, secteur, rayon = 5000) {
  const query = `${secteur} à ${ville}`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&radius=${rayon}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  const res = await axios.get(url);
  const places = res.data.results;

  const resultats = [];

  for (const place of places) {
    // Récupérer les détails de chaque lieu
    const details = await getPlaceDetails(place.place_id);
    
    const entreprise = {
      nom: place.name,
      adresse: place.formatted_address,
      note: place.rating || null,
      nombre_avis: place.user_ratings_total || 0,
      place_id: place.place_id,
      tel: details.tel || null,
      site: details.site || null,
      email: null,
      source: 'google_maps'
    };

    // Calculer le score
    entreprise.score = calculerScore(entreprise);
    resultats.push(entreprise);
  }

  return resultats;
}

async function getPlaceDetails(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  const res = await axios.get(url);
  const result = res.data.result;
  return {
    tel: result.formatted_phone_number || null,
    site: result.website || null
  };
}

// ── Scraping Pages Jaunes ──
async function chercherSurPagesJaunes(ville, secteur) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15');

  const url = `https://www.pagesjaunes.fr/pagesblanches/recherche?quoi=${encodeURIComponent(secteur)}&ou=${encodeURIComponent(ville)}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const content = await page.content();
    const $ = cheerio.load(content);

    const resultats = [];

    $('.bi-content').each((i, el) => {
      const nom = $(el).find('.denomination-links span').text().trim();
      const tel = $(el).find('.coord-numero').text().trim().replace(/\s/g, '');
      const adresse = $(el).find('.adresse').text().trim();
      const site = $(el).find('a[href*="http"]').attr('href') || null;

      if (nom) {
        resultats.push({
          nom,
          tel: tel || null,
          adresse,
          site,
          email: null,
          note: null,
          nombre_avis: 0,
          score: 0,
          source: 'pages_jaunes'
        });
      }
    });

    await browser.close();
    return resultats;

  } catch (err) {
    await browser.close();
    console.error('❌ Erreur Pages Jaunes:', err.message);
    return [];
  }
}

// ── Extraction email depuis site web ──
async function extraireEmail(siteUrl) {
  if (!siteUrl) return null;

  try {
    const res = await axios.get(siteUrl, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(res.data);
    const text = $('body').text();

    // Regex email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailRegex);

    if (emails) {
      // Filtrer les emails génériques
      const filtre = emails.find(e =>
        !e.includes('example') &&
        !e.includes('test') &&
        !e.includes('noreply') &&
        !e.includes('wordpress') &&
        !e.includes('sentry')
      );
      return filtre || null;
    }

    // Chercher aussi sur la page contact
    const contactLink = $('a[href*="contact"]').first().attr('href');
    if (contactLink) {
      const contactUrl = contactLink.startsWith('http') ? contactLink : siteUrl + contactLink;
      const contactRes = await axios.get(contactUrl, { timeout: 5000 });
      const $c = cheerio.load(contactRes.data);
      const contactEmails = $c('body').text().match(emailRegex);
      if (contactEmails) return contactEmails[0];
    }

    return null;
  } catch {
    return null;
  }
}

// ── Score de priorité ──
function calculerScore(entreprise) {
  let score = 0;

  if (!entreprise.site) score += 30;
  if (entreprise.note && entreprise.note < 3.5) score += 25;
  if (entreprise.note && entreprise.note >= 3.5 && entreprise.note < 4.0) score += 15;
  if (entreprise.nombre_avis < 10) score += 10;
  if (entreprise.tel) score += 10;
  if (entreprise.note && entreprise.note < 2.5) score += 20;

  return score;
}

// ── Pipeline complète ──
async function scannerVille(ville, secteur, rayon = 5000) {
  console.log(`🔍 Scan de ${secteur} à ${ville}...`);

  // 1. Google Maps
  console.log('📍 Google Maps...');
  const googleResultats = await chercherSurGoogleMaps(ville, secteur, rayon);
  console.log(`   → ${googleResultats.length} trouvés sur Google Maps`);

  // 2. Pages Jaunes
  console.log('📖 Pages Jaunes...');
  const pjResultats = await chercherSurPagesJaunes(ville, secteur);
  console.log(`   → ${pjResultats.length} trouvés sur Pages Jaunes`);

  // 3. Fusionner et dédupliquer
  const tous = [...googleResultats, ...pjResultats];
  const dedupliques = dedupliquer(tous);

  // 4. Extraire emails depuis les sites web
  console.log('📧 Extraction des emails...');
  for (const e of dedupliques) {
    if (e.site && !e.email) {
      e.email = await extraireEmail(e.site);
      if (e.email) console.log(`   ✅ Email trouvé : ${e.email} (${e.nom})`);
    }
    // Recalculer score avec email
    if (e.email) e.score += 15;
  }

  // 5. Filtrer (garder seulement ceux avec email ou tel)
  const filtrés = dedupliques.filter(e => e.email || e.tel);

  // 6. Trier par score décroissant
  filtrés.sort((a, b) => b.score - a.score);

  console.log(`✅ ${filtrés.length} prospects qualifiés prêts à envoyer`);
  return filtrés;
}

function dedupliquer(liste) {
  const vus = new Set();
  return liste.filter(e => {
    const key = e.nom.toLowerCase().replace(/\s/g, '');
    if (vus.has(key)) return false;
    vus.add(key);
    return true;
  });
}

module.exports = { scannerVille, extraireEmail };