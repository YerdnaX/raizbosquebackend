const crypto   = require('crypto');
const speakeasy = require('speakeasy');
const QRCode    = require('qrcode');

const ALGORITHM = 'aes-256-gcm';
const ISSUER    = 'Raíces de Bosque';

// ─── Cifrado / Descifrado ─────────────────────────────────────────────────────

function getEncryptionKey() {
  const hex = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  if (!hex) throw new Error('TWO_FACTOR_ENCRYPTION_KEY no está configurada en las variables de entorno.');
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) throw new Error('TWO_FACTOR_ENCRYPTION_KEY debe tener exactamente 64 caracteres hexadecimales (32 bytes).');
  return key;
}

function encryptSecret(plaintext) {
  const key    = getEncryptionKey();
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decryptSecret(ciphertext) {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Formato de secreto cifrado inválido.');
  const [ivHex, tagHex, encHex] = parts;
  const iv      = Buffer.from(ivHex,  'hex');
  const tag     = Buffer.from(tagHex, 'hex');
  const enc     = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString('utf8') + decipher.final('utf8');
}

// ─── TOTP ─────────────────────────────────────────────────────────────────────

function generateSecret(label) {
  return speakeasy.generateSecret({ length: 20, name: label, issuer: ISSUER });
}

function verifyToken(secretBase32, token, window = 1) {
  return speakeasy.totp.verify({
    secret:   secretBase32,
    encoding: 'base32',
    token:    String(token),
    window,
  });
}

function buildOtpauthUrl(secretBase32, label) {
  const enc  = encodeURIComponent;
  const iss  = enc(ISSUER);
  const lbl  = enc(label);
  return `otpauth://totp/${lbl}?secret=${secretBase32}&issuer=${iss}`;
}

async function buildQRImage(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl);
}

module.exports = { encryptSecret, decryptSecret, generateSecret, verifyToken, buildOtpauthUrl, buildQRImage };
