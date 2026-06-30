const nodemailer = require('nodemailer');
const dns = require('dns');

const EMAIL_FORCE_IPV4 = process.env.EMAIL_FORCE_IPV4 !== 'false';
const EMAIL_DNS_RESULT_ORDER = process.env.EMAIL_DNS_RESULT_ORDER || 'ipv4first';
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || 'auto').toLowerCase();

if (typeof dns.setDefaultResultOrder === 'function') {
  try {
    dns.setDefaultResultOrder(EMAIL_DNS_RESULT_ORDER);
  } catch (_) {
    // If unsupported by runtime, fallback to transport-level lookup.
  }
}

function lookupIpv4First(hostname, options, callback) {
  const opts = typeof options === 'function' ? {} : (options || {});
  const cb = typeof options === 'function' ? options : callback;
  return dns.lookup(hostname, { ...opts, family: 4, all: false }, cb);
}

function crearTransportador() {
  const cfg = {
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    requireTLS: process.env.EMAIL_SECURE !== 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Render and some SMTP providers can be slower during cold starts.
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    dnsTimeout: 30000,
    // Important in some cloud providers where outbound IPv6 is unavailable.
    family: EMAIL_FORCE_IPV4 ? 4 : undefined,
    lookup: EMAIL_FORCE_IPV4 ? lookupIpv4First : undefined,
    tls: {
      minVersion: 'TLSv1.2',
    },
  };

  return nodemailer.createTransport(cfg);
}

function remitente() {
  return process.env.EMAIL_FROM || process.env.EMAIL_USER;
}

function proveedorCorreo() {
  if (EMAIL_PROVIDER === 'smtp' || EMAIL_PROVIDER === 'resend') return EMAIL_PROVIDER;
  return process.env.RESEND_API_KEY ? 'resend' : 'smtp';
}

async function enviarPorResend({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY no configurado');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: remitente(),
      to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const detalle = await response.text();
    throw new Error(`Resend HTTP ${response.status}: ${detalle}`);
  }
}

async function enviarPorSmtp({ to, subject, text, html }) {
  const t = crearTransportador();
  await t.sendMail({
    from: remitente(),
    to,
    subject,
    text,
    html,
  });
}

async function enviarCorreo(payload) {
  const provider = proveedorCorreo();
  if (provider === 'resend') return enviarPorResend(payload);
  return enviarPorSmtp(payload);
}

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
