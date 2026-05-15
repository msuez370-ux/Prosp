const axios = require('axios');

const HEADERS = {
  'api-key': process.env.BREVO_API_KEY,
  'Content-Type': 'application/json'
};

const LOGO_URL = 'https://ikreet-audio.s3.eu-north-1.amazonaws.com/logo-ikreet.png';

const SIGNATURE_HTML = `
<div style="margin-top:32px;padding-top:20px;border-top:2px solid #1a3a5c;font-family:Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding-right:20px;vertical-align:middle;">
        <img src="${LOGO_URL}" alt="IKREET" width="120" style="display:block;">
      </td>
      <td style="vertical-align:middle;border-left:3px solid #f97316;padding-left:16px;">
        <p style="margin:0;font-size:15px;font-weight:bold;color:#1a3a5c;">Mohamed Boussari</p>
        <p style="margin:4px 0 0;font-size:13px;color:#666;">Agence IKREET — Sites web & Réputation en ligne</p>
        <p style="margin:8px 0 0;font-size:13px;color:#1a3a5c;">
          📞 <a href="tel:+33748338443" style="color:#1a3a5c;text-decoration:none;">07 48 33 84 43</a>
        </p>
        <p style="margin:4px 0 0;font-size:13px;color:#1a3a5c;">
          ✉️ <a href="mailto:contact@mohamed-boussari.fr" style="color:#f97316;text-decoration:none;">contact@mohamed-boussari.fr</a>
        </p>
        <p style="margin:8px 0 0;">
          <a href="https://ikreet.fr" style="display:inline-block;background:#1a3a5c;color:white;padding:6px 14px;border-radius:4px;font-size:12px;text-decoration:none;font-weight:bold;">🌐 ikreet.fr</a>
        </p>
      </td>
    </tr>
  </table>
  <p style="margin-top:16px;font-size:10px;color:#999;">
    Vous recevez cet email car votre commerce a été identifié comme pouvant bénéficier de nos services. 
    Pour ne plus recevoir nos communications, répondez simplement "STOP".
  </p>
</div>
`;

async function envoyerEmail(prospect, emailObjet, emailCorps) {
  if (!prospect.email) return null;

  // Convertir le texte en HTML avec signature
  const corpsHTML = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.6;">
      <div style="background:#1a3a5c;padding:16px 24px;border-radius:8px 8px 0 0;">
        <img src="${LOGO_URL}" alt="IKREET" height="40" style="display:block;">
      </div>
      <div style="padding:24px;background:#ffffff;border:1px solid #e0e0e0;">
        ${emailCorps.replace(/\n/g, '<br>').replace(/•/g, '&bull;')}
        ${SIGNATURE_HTML}
      </div>
    </div>
  `;

  await axios.post('https://api.brevo.com/v3/smtp/email', {
    sender: { name: 'Mohamed — IKREET', email: process.env.BREVO_EMAIL_SENDER },
    to: [{ email: prospect.email, name: prospect.nom }],
    subject: emailObjet,
    htmlContent: corpsHTML,
    textContent: emailCorps + '\n\n---\nMohamed Boussari — IKREET\nTél : 07 48 33 84 43\nEmail : contact@mohamed-boussari.fr\nSite : ikreet.fr'
  }, { headers: HEADERS });

  console.log(`✅ Email envoyé à ${prospect.email}`);
}

async function envoyerSMS(prospect, sms) {
  if (!prospect.tel) return null;

  let tel = prospect.tel.replace(/\s/g, '');
  if (tel.startsWith('0')) tel = '+33' + tel.slice(1);

  await axios.post('https://api.brevo.com/v3/transactionalSMS/sms', {
    sender: process.env.BREVO_SMS_SENDER,
    recipient: tel,
    content: sms
  }, { headers: HEADERS });

  console.log(`✅ SMS envoyé à ${tel}`);
}

module.exports = { envoyerEmail, envoyerSMS };