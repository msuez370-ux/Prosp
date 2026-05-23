const axios = require('axios');
const cheerio = require('cheerio');

// ── Google Maps Places API ──
async function chercherSurGoogleMaps(ville, secteur, rayon = 5000) {
  const query = `${secteur} à ${ville}`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&radius=${rayon}&language=fr&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  const res = await axios.get(url);
  const places = res.data.results || [];
  const resultats = [];

  for (const place of places) {
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
    entreprise.score = calculerScore(entreprise);
    resultats.push(entreprise);
  }

  return resultats;
}

async function getPlaceDetails(placeId) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const res = await axios.get(url);
    const result = res.data.result || {};
    return {
      tel: result.formatted_phone_number || null,
      site: result.website || null
    };
  } catch {
    return { tel: null, site: null };
  }
}

// ── Extraction email depuis site web ──
async function extraireEmail(siteUrl) {
  if (!siteUrl) return null;

  try {
    const res = await axios.get(siteUrl, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15' }
    });

    const $ = cheerio.load(res.data);
    const text = $('body').text();
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailRegex);

    if (emails) {
      const filtre = emails.find(e =>
        !e.includes('example') &&
        !e.includes('test') &&
        !e.includes('noreply') &&
        !e.includes('wordpress') &&
        !e.includes('sentry') &&
        !e.includes('wix') &&
        !e.includes('schema')
      );
      if (filtre) return filtre;
    }

    // Chercher sur la page contact
    const contactLink = $('a[href*="contact"]').first().attr('href');
    if (contactLink) {
      const contactUrl = contactLink.startsWith('http')
        ? contactLink
        : siteUrl.replace(/\/$/, '') + '/' + contactLink.replace(/^\//, '');
      try {
        const contactRes = await axios.get(contactUrl, { timeout: 5000 });
        const $c = cheerio.load(contactRes.data);
        const contactEmails = $c('body').text().match(emailRegex);
        if (contactEmails) return contactEmails[0];
      } catch {}
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
  if (entreprise.note && entreprise.note < 2.5) score += 45;
  else if (entreprise.note && entreprise.note < 3.5) score += 25;
  else if (entreprise.note && entreprise.note < 4.0) score += 15;
  if (entreprise.nombre_avis < 10) score += 10;
  if (entreprise.tel) score += 10;
  if (entreprise.email) score += 15;
  return score;
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

function construireProblemes(entreprise) {
  const problemes = [];
  if (!entreprise.site) problemes.push('Pas de site web');
  if (entreprise.note && entreprise.note < 3.5) problemes.push('Mauvais avis en premier');
  if (entreprise.nombre_avis < 10) problemes.push('Peu d\'avis Google');
  return problemes;
}

// ── Pipeline complète ──
async function scannerVille(ville, secteur, rayon = 5000) {
  console.log(`🔍 Scan de ${secteur} à ${ville}...`);

  // 1. Google Maps
  console.log('📍 Google Maps...');
  const resultats = await chercherSurGoogleMaps(ville, secteur, rayon);
  console.log(`   → ${resultats.length} trouvés`);

  // 2. Dédupliquer
  const dedupliques = dedupliquer(resultats);

  // 3. Extraire emails depuis les sites web
  console.log('📧 Extraction des emails...');
  for (const e of dedupliques) {
    if (e.site && !e.email) {
      e.email = await extraireEmail(e.site);
      if (e.email) {
        e.score += 15;
        console.log(`   ✅ Email trouvé : ${e.email} (${e.nom})`);
      }
    }
    e.problemes = construireProblemes(e);
  }

  // 4. Filtrer — garder ceux avec email OU tel
  const filtres = dedupliques.filter(e => e.email || e.tel);

  // 5. Trier par score
  filtres.sort((a, b) => b.score - a.score);

  console.log(`✅ ${filtres.length} prospects qualifiés prêts`);
  return filtres;
}

module.exports = { scannerVille, extraireEmail };