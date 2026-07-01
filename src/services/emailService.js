const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS) || 25000;

// ─── OAuth2 / Gmail API ───────────────────────────────────────────────────────

async function fetchConTimeout(url, opciones) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opciones, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function obtenerAccessToken() {
  const res = await fetchConTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }).toString(),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

function construirMensajeRFC2822({ to, subject, text, html }) {
  const from   = process.env.GMAIL_USER;
  const boundary = `rb_${Date.now()}`;

  // RFC 2047 — codifica encabezados con caracteres no ASCII
  const enc = (str) => `=?UTF-8?B?${Buffer.from(str).toString('base64')}?=`;

  const lineas = [
    `From: ${enc('Raíces Café & Vivero')} <${from}>`,
    `To: ${to}`,
    `Subject: ${enc(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    '',
    `--${boundary}--`,
  ];

  return Buffer.from(lineas.join('\r\n')).toString('base64url');
}

async function enviarCorreo(payload) {
  const accessToken = await obtenerAccessToken();
  const raw = construirMensajeRFC2822(payload);

  const res = await fetchConTimeout(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    },
  );

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`Gmail API ${res.status}: ${detalle}`);
  }
}

// ─── Funciones públicas ───────────────────────────────────────────────────────

async function enviarCodigoVerificacion(correo, codigo) {
  await enviarCorreo({
    to: correo,
    subject: 'Código de verificación — Raíces Café & Vivero',
    text: `Tu código de verificación es: ${codigo}\n\nVigencia: 1 hora. No lo compartas con nadie.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#fefcf8;border-radius:16px;">
        <h2 style="color:#1b3022;text-align:center;">Raíces Café &amp; Vivero</h2>
        <p style="color:#434843;text-align:center;">Tu código de verificación es:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:12px;text-align:center;color:#1b3022;
                    background:#f0eee8;padding:16px;border-radius:12px;margin:16px 0;">${codigo}</div>
        <p style="color:#737973;font-size:13px;text-align:center;">
          Vigencia: <strong>1 hora</strong>. No lo compartas con nadie.
        </p>
      </div>`,
  });
}

async function enviarCodigoRecuperacion(correo, codigo) {
  await enviarCorreo({
    to: correo,
    subject: 'Recuperación de contraseña — Raíces Café & Vivero',
    text: `Tu código de recuperación es: ${codigo}\n\nVigencia: 1 hora. No lo compartas con nadie.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#fefcf8;border-radius:16px;">
        <h2 style="color:#1b3022;text-align:center;">Raíces Café &amp; Vivero</h2>
        <p style="color:#434843;text-align:center;">Tu código de recuperación de contraseña es:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:12px;text-align:center;color:#1b3022;
                    background:#f0eee8;padding:16px;border-radius:12px;margin:16px 0;">${codigo}</div>
        <p style="color:#737973;font-size:13px;text-align:center;">
          Vigencia: <strong>1 hora</strong>. Si no solicitaste este código, ignora este correo.
        </p>
      </div>`,
  });
}

async function enviarNombreUsuario(correo, nombreUsuario) {
  await enviarCorreo({
    to: correo,
    subject: 'Tu nombre de usuario — Raíces Café & Vivero',
    text: `Tu nombre de usuario en Raíces Café & Vivero es: ${nombreUsuario}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#fefcf8;border-radius:16px;">
        <h2 style="color:#1b3022;text-align:center;">Raíces Café &amp; Vivero</h2>
        <p style="color:#434843;text-align:center;">Tu nombre de usuario es:</p>
        <div style="font-size:24px;font-weight:700;text-align:center;color:#1b3022;
                    background:#f0eee8;padding:16px;border-radius:12px;margin:16px 0;">${nombreUsuario}</div>
        <p style="color:#737973;font-size:13px;text-align:center;">Mantén esta información segura.</p>
      </div>`,
  });
}

module.exports = { enviarCodigoVerificacion, enviarCodigoRecuperacion, enviarNombreUsuario };
