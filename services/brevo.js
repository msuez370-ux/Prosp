const axios = require('axios');

const HEADERS = {
  'api-key': process.env.BREVO_API_KEY,
  'Content-Type': 'application/json'
};

const LOGO_URL = 'https://ikreet-audio.s3.eu-north-1.amazonaws.com/logo-ikreet.png';

function construireEmailHTML(emailCorps) {
  const corpsFormate = emailCorps
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/•/g, '&bull;');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:#1a3a5c;padding:20px 30px;border-radius:8px 8px 0 0;">
              <img src="${LOGO_URL}" alt="IKREET" height="45" style="display:block;">
            </td>
          </tr>

          <!-- CORPS -->
          <tr>
            <td style="background:#ffffff;padding:30px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <div style="font-size:15px;color:#333;line-height:1.7;">
                ${corpsFormate}
              </div>
            </td>
          </tr>

          <!-- SIGNATURE -->
          <tr>
            <td style="background:#ffffff;padding:0 30px 30px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                style="border-top:2px solid #1a3a5c;padding-top:20px;margin-top:10px;">
                <tr>
                  <td style="padding-top:20px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right:20px;vertical-align:middle;">
                          <img src="${LOGO_URL}" alt="IKREET" width="100" style="display:block;">
                        </td>
                        <td style="vertical-align:middle;border-left:3px solid #f97316;padding-left:16px;">
                          <p style="margin:0;font-size:15px;font-weight:bold;color:#1a3a5c;">
                            Mohamed Boussari
                          </p>
                          <p style="margin:3px 0 0;font-size:12px;color:#888;">
                            Agence IKREET — Sites web & Réputation en ligne
                          </p>
                          <p style="margin:10px 0 0;font-size:13px;color:#1a3a5c;">
                            📞 <a href="tel:+33748338443"
                              style="color:#1a3a5c;text-decoration:none;font-weight:bold;">
                              07 48 33 84 43
                            </a>
                          </p>
                          <p style="margin:4px 0 0;font-size:13px;">
                            ✉️ <a href="mailto:contact@mohamed-boussari.fr"
                              style="color:#f97316;text-decoration:none;font-weight:bold;">
                              contact@mohamed-boussari.fr
                            </a>
                          </p>
                          <p style="margin:10px 0 0;">
                            <a href="https://mohamed-boussari.fr"
                              style="display:inline-block;background:#1a3a5c;color:#ffffff;
                              padding:7px 16px;border-radius:4px;font-size:12px;
                              text-decoration:none;font-weight:bold;">
                              🌐 mohamed-boussari.fr
                            </a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f9f9f9;padding:14px 30px;border:1px solid #e0e0e0;
              border-radius:0 0 8px 8px;text-align:center;">
              <p style="margin:0;font-size:10px;color:#aaa;line-height:1.5;">
                Vous recevez cet email car votre commerce a été identifié comme pouvant bénéficier 
                de nos services.<br>
                Pour ne plus recevoir nos communications, répondez simplement <strong>STOP</strong>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function envoyerEmail(prospect, emailObjet, emailCorps) {
  if (!prospect.email) return null;

  await axios.post('https://api.brevo.com/v3/smtp/email', {
    sender: {
      name: 'Mohamed — IKREET',
      email: process.env.BREVO_EMAIL_SENDER
    },
    to: [{ email: prospect.email, name: prospect.nom }],
    subject: emailObjet,
    htmlContent: construireEmailHTML(emailCorps),
    textContent: emailCorps + `

---
Mohamed Boussari — Agence IKREET
Tél : 07 48 33 84 43
Email : contact@mohamed-boussari.fr
Site : mohamed-boussari.fr

Pour ne plus recevoir nos communications, répondez STOP.`
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