const crypto = require('crypto');
const bcrypt  = require('bcryptjs');
const { getConnection, sql } = require('../config/db');
const { encryptSecret, decryptSecret, generateSecret, verifyToken, buildOtpauthUrl, buildQRImage } = require('../utils/totp');

// ─── Sesiones temporales de la app OTP (solo en memoria, no persistentes) ─────

const otpSessions = new Map();
const OTP_SESSION_DURATION_MS = 5 * 60 * 1000; // 5 minutos

function crearSesionOtp(userId) {
  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + OTP_SESSION_DURATION_MS;
  otpSessions.set(token, { userId, expiresAt });
  setTimeout(() => otpSessions.delete(token), OTP_SESSION_DURATION_MS);
  return token;
}

function validarSesionOtp(token) {
  const sesion = otpSessions.get(token);
  if (!sesion || Date.now() > sesion.expiresAt) {
    otpSessions.delete(token);
    return null;
  }
  return sesion;
}

function eliminarSesionOtp(token) {
  otpSessions.delete(token);
}

// ─── GET /api/auth/2fa/status?idUsuario=X ────────────────────────────────────

async function getStatus(req, res) {
  const { idUsuario } = req.query;
  if (!idUsuario) return res.status(400).json({ codigo: 'CAMPO_REQUERIDO', error: 'idUsuario requerido' });

  try {
    const pool = await getConnection();
    const r = await pool.request()
      .input('id', sql.Int, Number(idUsuario))
      .query('SELECT TwoFactorEnabled, TwoFactorMethod FROM Usuarios WHERE IdUsuario = @id AND Estado = 1');

    if (r.recordset.length === 0) return res.status(404).json({ codigo: 'USER_NOT_FOUND', error: 'Usuario no encontrado' });

    const { TwoFactorEnabled, TwoFactorMethod } = r.recordset[0];
    res.json({ success: true, enabled: !!TwoFactorEnabled, method: TwoFactorMethod || null });
  } catch (err) {
    console.error('[2fa.getStatus]', err.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al obtener estado 2FA' });
  }
}

// ─── POST /api/auth/2fa/setup ─────────────────────────────────────────────────
// Inicia la configuración 2FA. Genera y guarda el secreto (aún no activo).
// Para GOOGLE_AUTHENTICATOR: retorna qrImage y manualKey.
// Para PERSONAL_AUTHENTICATOR: retorna pendingSetup (la vinculación la completa raizbosqueotp).

async function setup(req, res) {
  const { idUsuario, method } = req.body;
  if (!idUsuario || !method) return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'idUsuario y method son requeridos' });
  if (!['GOOGLE_AUTHENTICATOR', 'PERSONAL_AUTHENTICATOR'].includes(method)) {
    return res.status(400).json({ codigo: 'METHOD_INVALIDO', error: 'method debe ser GOOGLE_AUTHENTICATOR o PERSONAL_AUTHENTICATOR' });
  }

  try {
    const pool = await getConnection();
    const user = await pool.request()
      .input('id', sql.Int, idUsuario)
      .query('SELECT IdUsuario, Correo, NombreUsuario, TwoFactorEnabled FROM Usuarios WHERE IdUsuario = @id AND Estado = 1');

    if (user.recordset.length === 0) return res.status(404).json({ codigo: 'USER_NOT_FOUND', error: 'Usuario no encontrado' });

    const u = user.recordset[0];
    if (u.TwoFactorEnabled) return res.status(409).json({ codigo: '2FA_YA_ACTIVO', error: 'Ya tienes 2FA activo. Desactívalo primero.' });

    const label  = u.NombreUsuario || u.Correo;
    const secret = generateSecret(label);
    const enc    = encryptSecret(secret.base32);
    const ahora  = new Date();

    await pool.request()
      .input('id',     sql.Int,          idUsuario)
      .input('method', sql.NVarChar(50),  method)
      .input('secret', sql.NVarChar(700), enc)
      .input('ahora',  sql.DateTime,      ahora)
      .query(`UPDATE Usuarios
              SET TwoFactorMethod           = @method,
                  TwoFactorSecretEncrypted  = @secret,
                  TwoFactorEnabled          = 0,
                  TwoFactorCreatedAt        = @ahora,
                  TwoFactorUpdatedAt        = @ahora
              WHERE IdUsuario = @id`);

    if (method === 'GOOGLE_AUTHENTICATOR') {
      const otpauthUrl = buildOtpauthUrl(secret.base32, label);
      const qrImage    = await buildQRImage(otpauthUrl);
      return res.json({ success: true, qrImage, manualKey: secret.base32 });
    }

    // PERSONAL_AUTHENTICATOR: la vinculación la hace raizbosqueotp
    res.json({ success: true, pendingSetup: true });
  } catch (err) {
    console.error('[2fa.setup]', err.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al iniciar configuración 2FA' });
  }
}

// ─── POST /api/auth/2fa/verify-setup ─────────────────────────────────────────
// Verifica el primer código OTP y activa 2FA para Google Authenticator.

async function verifySetup(req, res) {
  const { idUsuario, code } = req.body;
  if (!idUsuario || !code) return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'idUsuario y code son requeridos' });

  try {
    const pool = await getConnection();
    const user = await pool.request()
      .input('id', sql.Int, idUsuario)
      .query('SELECT TwoFactorSecretEncrypted, TwoFactorEnabled, TwoFactorMethod FROM Usuarios WHERE IdUsuario = @id AND Estado = 1');

    if (user.recordset.length === 0) return res.status(404).json({ codigo: 'USER_NOT_FOUND', error: 'Usuario no encontrado' });

    const { TwoFactorSecretEncrypted, TwoFactorEnabled, TwoFactorMethod } = user.recordset[0];

    if (TwoFactorEnabled) return res.status(409).json({ codigo: '2FA_YA_ACTIVO', error: '2FA ya está activo' });
    if (!TwoFactorSecretEncrypted) return res.status(400).json({ codigo: '2FA_NO_CONFIGURADO', error: 'Primero inicia la configuración 2FA' });
    if (TwoFactorMethod !== 'GOOGLE_AUTHENTICATOR') return res.status(400).json({ codigo: 'METHOD_INCORRECTO', error: 'Este endpoint es para Google Authenticator' });

    const secretPlain = decryptSecret(TwoFactorSecretEncrypted);
    if (!verifyToken(secretPlain, code)) {
      return res.status(401).json({ codigo: 'INVALID_2FA_CODE', error: 'Código inválido. Inténtalo nuevamente.' });
    }

    await pool.request()
      .input('id',    sql.Int,      idUsuario)
      .input('ahora', sql.DateTime, new Date())
      .query('UPDATE Usuarios SET TwoFactorEnabled = 1, TwoFactorUpdatedAt = @ahora WHERE IdUsuario = @id');

    res.json({ success: true, mensaje: 'Verificación en dos pasos activada correctamente' });
  } catch (err) {
    console.error('[2fa.verifySetup]', err.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al verificar el código' });
  }
}

// ─── POST /api/auth/2fa/verify-login ─────────────────────────────────────────
// Completa el login cuando el usuario tiene 2FA activo.

async function verifyLogin(req, res) {
  const { userId, code } = req.body;
  if (!userId || !code) return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'userId y code son requeridos' });

  try {
    const pool = await getConnection();
    const user = await pool.request()
      .input('id', sql.Int, userId)
      .query(`SELECT IdUsuario, Nombre, Apellidos, Correo, NombreUsuario, Telefono, Direccion,
                     Estado, IdRol, TwoFactorEnabled, TwoFactorMethod, TwoFactorSecretEncrypted
              FROM Usuarios WHERE IdUsuario = @id AND Estado = 1`);

    if (user.recordset.length === 0) return res.status(404).json({ codigo: 'USER_NOT_FOUND', error: 'Usuario no encontrado' });

    const u = user.recordset[0];
    if (!u.TwoFactorEnabled || !u.TwoFactorSecretEncrypted) {
      return res.status(400).json({ codigo: '2FA_NO_ACTIVO', error: '2FA no está activo para este usuario' });
    }

    const secretPlain = decryptSecret(u.TwoFactorSecretEncrypted);
    if (!verifyToken(secretPlain, code)) {
      return res.status(401).json({ codigo: 'INVALID_2FA_CODE', error: 'Código inválido. Inténtalo nuevamente.' });
    }

    const rolRes = await pool.request()
      .input('idRol', sql.Int, u.IdRol)
      .query('SELECT NombreRol FROM Roles WHERE IdRol = @idRol');
    const nombreRol = rolRes.recordset[0]?.NombreRol || '';

    res.json({
      success: true,
      usuario: {
        IdUsuario:    u.IdUsuario,
        Nombre:       u.Nombre,
        Apellidos:    u.Apellidos,
        Correo:       u.Correo,
        NombreUsuario:u.NombreUsuario,
        Telefono:     u.Telefono,
        Direccion:    u.Direccion,
        Estado:       u.Estado,
        IdRol:        u.IdRol,
        NombreRol:    nombreRol,
        TieneTotp2FA: true,
        MetodoTotp2FA:u.TwoFactorMethod,
      },
    });
  } catch (err) {
    console.error('[2fa.verifyLogin]', err.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al verificar el código 2FA' });
  }
}

// ─── POST /api/auth/2fa/disable ───────────────────────────────────────────────
// Desactiva 2FA. Requiere contraseña actual + código OTP vigente.

async function disable(req, res) {
  const { idUsuario, contrasena, code } = req.body;
  if (!idUsuario || !contrasena || !code) {
    return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'idUsuario, contrasena y code son requeridos' });
  }

  try {
    const pool = await getConnection();
    const user = await pool.request()
      .input('id', sql.Int, idUsuario)
      .query('SELECT ContrasenaHash, Contrasena, TwoFactorEnabled, TwoFactorSecretEncrypted FROM Usuarios WHERE IdUsuario = @id AND Estado = 1');

    if (user.recordset.length === 0) return res.status(404).json({ codigo: 'USER_NOT_FOUND', error: 'Usuario no encontrado' });

    const u = user.recordset[0];
    if (!u.TwoFactorEnabled) return res.status(400).json({ codigo: '2FA_NO_ACTIVO', error: '2FA no está activo' });

    // Verificar contraseña
    let passwordOk = false;
    if (u.ContrasenaHash) passwordOk = await bcrypt.compare(contrasena, u.ContrasenaHash);
    else if (u.Contrasena) passwordOk = (contrasena === u.Contrasena);
    if (!passwordOk) return res.status(401).json({ codigo: 'INVALID_CREDENTIALS', error: 'Contraseña incorrecta' });

    // Verificar código OTP
    const secretPlain = decryptSecret(u.TwoFactorSecretEncrypted);
    if (!verifyToken(secretPlain, code)) {
      return res.status(401).json({ codigo: 'INVALID_2FA_CODE', error: 'Código inválido. Inténtalo nuevamente.' });
    }

    await pool.request()
      .input('id',    sql.Int,      idUsuario)
      .input('ahora', sql.DateTime, new Date())
      .query(`UPDATE Usuarios
              SET TwoFactorEnabled         = 0,
                  TwoFactorMethod          = NULL,
                  TwoFactorSecretEncrypted = NULL,
                  TwoFactorDeviceLinkedAt  = NULL,
                  TwoFactorUpdatedAt       = @ahora
              WHERE IdUsuario = @id`);

    res.json({ success: true, mensaje: 'Verificación en dos pasos desactivada correctamente' });
  } catch (err) {
    console.error('[2fa.disable]', err.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al desactivar 2FA' });
  }
}

// ─── POST /api/auth/otp-app/login ─────────────────────────────────────────────
// Login exclusivo para la app raizbosqueotp. Devuelve un sessionToken temporal (5 min).
// No emite refresh token. El sessionToken es solo para operaciones de vinculación.

async function otpAppLogin(req, res) {
  const { identificador, contrasena } = req.body;
  if (!identificador || !contrasena) {
    return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'identificador y contrasena son requeridos' });
  }

  try {
    const pool = await getConnection();
    const busqueda = await pool.request()
      .input('id', sql.VarChar(150), identificador)
      .query(`SELECT IdUsuario, Nombre, Correo, NombreUsuario,
                     ContrasenaHash, Contrasena, CuentaBloqueada, IntentosFallidos,
                     FechaExpiracionContrasena, TwoFactorEnabled, TwoFactorMethod
              FROM Usuarios
              WHERE (Correo = @id OR LOWER(NombreUsuario) = LOWER(@id)) AND Estado = 1`);

    if (busqueda.recordset.length === 0) {
      return res.status(401).json({ codigo: 'INVALID_CREDENTIALS', error: 'Credenciales incorrectas' });
    }

    const u = busqueda.recordset[0];

    if (u.CuentaBloqueada) {
      return res.status(403).json({ codigo: 'ACCOUNT_LOCKED', error: 'Cuenta bloqueada. Recupera tu contraseña en la app principal.' });
    }

    let passwordOk = false;
    if (u.ContrasenaHash) passwordOk = await bcrypt.compare(contrasena, u.ContrasenaHash);
    else if (u.Contrasena) passwordOk = (contrasena === u.Contrasena);

    if (!passwordOk) {
      const nuevosIntentos = (u.IntentosFallidos || 0) + 1;
      if (nuevosIntentos >= 3) {
        await pool.request()
          .input('id', sql.Int, u.IdUsuario)
          .query('UPDATE Usuarios SET IntentosFallidos = @intentos, CuentaBloqueada = 1, FechaBloqueo = GETDATE() WHERE IdUsuario = @id'
            .replace('@intentos', nuevosIntentos));
        return res.status(403).json({ codigo: 'ACCOUNT_LOCKED', error: 'Cuenta bloqueada tras tres intentos fallidos.' });
      }
      await pool.request()
        .input('id',       sql.Int, u.IdUsuario)
        .input('intentos', sql.Int, nuevosIntentos)
        .query('UPDATE Usuarios SET IntentosFallidos = @intentos WHERE IdUsuario = @id');
      return res.status(401).json({ codigo: 'INVALID_CREDENTIALS', error: 'Credenciales incorrectas' });
    }

    // Contraseña correcta → resetear intentos
    await pool.request()
      .input('id', sql.Int, u.IdUsuario)
      .query('UPDATE Usuarios SET IntentosFallidos = 0 WHERE IdUsuario = @id');

    if (u.FechaExpiracionContrasena && new Date() > new Date(u.FechaExpiracionContrasena)) {
      return res.status(403).json({ codigo: 'PASSWORD_EXPIRED', error: 'Tu contraseña ha vencido. Cámbiala en la app principal.' });
    }

    const sessionToken = crearSesionOtp(u.IdUsuario);

    res.json({
      success:       true,
      sessionToken,
      userId:        u.IdUsuario,
      correo:        u.Correo,
      nombreUsuario: u.NombreUsuario,
      deviceLinked:  !!(u.TwoFactorEnabled && u.TwoFactorMethod === 'PERSONAL_AUTHENTICATOR'),
      twoFactorMethod: u.TwoFactorMethod || null,
    });
  } catch (err) {
    console.error('[2fa.otpAppLogin]', err.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al iniciar sesión' });
  }
}

// ─── POST /api/auth/otp-app/link ──────────────────────────────────────────────
// Vincula el dispositivo OTP. Genera o reutiliza el secreto TOTP y lo retorna
// en texto plano SOLO en este momento para que raizbosqueotp lo guarde en SecureStore.

async function otpAppLink(req, res) {
  const { userId, sessionToken } = req.body;
  if (!userId || !sessionToken) return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'userId y sessionToken son requeridos' });

  const sesion = validarSesionOtp(sessionToken);
  if (!sesion || sesion.userId !== Number(userId)) {
    return res.status(401).json({ codigo: 'SESSION_INVALIDA', error: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });
  }

  try {
    const pool = await getConnection();
    const user = await pool.request()
      .input('id', sql.Int, userId)
      .query('SELECT IdUsuario, Correo, NombreUsuario, TwoFactorEnabled, TwoFactorMethod, TwoFactorSecretEncrypted FROM Usuarios WHERE IdUsuario = @id AND Estado = 1');

    if (user.recordset.length === 0) return res.status(404).json({ codigo: 'USER_NOT_FOUND', error: 'Usuario no encontrado' });

    const u = user.recordset[0];

    // Si ya hay un secreto para PERSONAL_AUTHENTICATOR, lo reutilizamos
    let secretPlain;
    if (u.TwoFactorMethod === 'PERSONAL_AUTHENTICATOR' && u.TwoFactorSecretEncrypted) {
      secretPlain = decryptSecret(u.TwoFactorSecretEncrypted);
    } else {
      // Genera secreto nuevo
      const label  = u.NombreUsuario || u.Correo;
      const secret = generateSecret(label);
      secretPlain  = secret.base32;
      const enc    = encryptSecret(secretPlain);
      const ahora  = new Date();
      await pool.request()
        .input('id',     sql.Int,          userId)
        .input('secret', sql.NVarChar(700), enc)
        .input('ahora',  sql.DateTime,      ahora)
        .query(`UPDATE Usuarios
                SET TwoFactorMethod          = 'PERSONAL_AUTHENTICATOR',
                    TwoFactorSecretEncrypted = @secret,
                    TwoFactorEnabled         = 0,
                    TwoFactorCreatedAt       = @ahora,
                    TwoFactorUpdatedAt       = @ahora
                WHERE IdUsuario = @id`);
    }

    res.json({ success: true, secret: secretPlain });
  } catch (err) {
    console.error('[2fa.otpAppLink]', err.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al vincular dispositivo' });
  }
}

// ─── POST /api/auth/otp-app/confirm-link ──────────────────────────────────────
// Confirma la vinculación verificando un código OTP y activa 2FA.

async function otpAppConfirmLink(req, res) {
  const { userId, sessionToken, code } = req.body;
  if (!userId || !sessionToken || !code) {
    return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'userId, sessionToken y code son requeridos' });
  }

  const sesion = validarSesionOtp(sessionToken);
  if (!sesion || sesion.userId !== Number(userId)) {
    return res.status(401).json({ codigo: 'SESSION_INVALIDA', error: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });
  }

  try {
    const pool = await getConnection();
    const user = await pool.request()
      .input('id', sql.Int, userId)
      .query('SELECT TwoFactorSecretEncrypted, TwoFactorMethod FROM Usuarios WHERE IdUsuario = @id AND Estado = 1');

    if (user.recordset.length === 0) return res.status(404).json({ codigo: 'USER_NOT_FOUND', error: 'Usuario no encontrado' });

    const { TwoFactorSecretEncrypted, TwoFactorMethod } = user.recordset[0];

    if (!TwoFactorSecretEncrypted || TwoFactorMethod !== 'PERSONAL_AUTHENTICATOR') {
      return res.status(400).json({ codigo: '2FA_NO_CONFIGURADO', error: 'El dispositivo no ha sido preparado para vinculación' });
    }

    const secretPlain = decryptSecret(TwoFactorSecretEncrypted);
    if (!verifyToken(secretPlain, code)) {
      return res.status(401).json({ codigo: 'INVALID_2FA_CODE', error: 'Código inválido. Inténtalo nuevamente.' });
    }

    const ahora = new Date();
    await pool.request()
      .input('id',    sql.Int,      userId)
      .input('ahora', sql.DateTime, ahora)
      .query('UPDATE Usuarios SET TwoFactorEnabled = 1, TwoFactorDeviceLinkedAt = @ahora, TwoFactorUpdatedAt = @ahora WHERE IdUsuario = @id');

    res.json({ success: true, mensaje: 'Dispositivo vinculado correctamente. La verificación en dos pasos ya está activa.' });
  } catch (err) {
    console.error('[2fa.otpAppConfirmLink]', err.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al confirmar vinculación' });
  }
}

// ─── POST /api/auth/otp-app/unlink ────────────────────────────────────────────
// Desvincula el dispositivo (desactiva 2FA del tipo PERSONAL_AUTHENTICATOR).

async function otpAppUnlink(req, res) {
  const { userId, sessionToken, code } = req.body;
  if (!userId || !sessionToken || !code) {
    return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'userId, sessionToken y code son requeridos' });
  }

  const sesion = validarSesionOtp(sessionToken);
  if (!sesion || sesion.userId !== Number(userId)) {
    return res.status(401).json({ codigo: 'SESSION_INVALIDA', error: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });
  }

  try {
    const pool = await getConnection();
    const user = await pool.request()
      .input('id', sql.Int, userId)
      .query('SELECT TwoFactorEnabled, TwoFactorMethod, TwoFactorSecretEncrypted FROM Usuarios WHERE IdUsuario = @id AND Estado = 1');

    if (user.recordset.length === 0) return res.status(404).json({ codigo: 'USER_NOT_FOUND', error: 'Usuario no encontrado' });

    const { TwoFactorEnabled, TwoFactorMethod, TwoFactorSecretEncrypted } = user.recordset[0];

    if (!TwoFactorEnabled || TwoFactorMethod !== 'PERSONAL_AUTHENTICATOR') {
      return res.status(400).json({ codigo: '2FA_NO_ACTIVO', error: 'El autenticador personal no está activo' });
    }

    const secretPlain = decryptSecret(TwoFactorSecretEncrypted);
    if (!verifyToken(secretPlain, code)) {
      return res.status(401).json({ codigo: 'INVALID_2FA_CODE', error: 'Código inválido. Inténtalo nuevamente.' });
    }

    await pool.request()
      .input('id',    sql.Int,      userId)
      .input('ahora', sql.DateTime, new Date())
      .query(`UPDATE Usuarios
              SET TwoFactorEnabled         = 0,
                  TwoFactorMethod          = NULL,
                  TwoFactorSecretEncrypted = NULL,
                  TwoFactorDeviceLinkedAt  = NULL,
                  TwoFactorUpdatedAt       = @ahora
              WHERE IdUsuario = @id`);

    res.json({ success: true, mensaje: 'Dispositivo desvinculado correctamente.' });
  } catch (err) {
    console.error('[2fa.otpAppUnlink]', err.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al desvincular dispositivo' });
  }
}

// ─── POST /api/auth/otp-app/logout ────────────────────────────────────────────

async function otpAppLogout(req, res) {
  const { sessionToken } = req.body;
  if (sessionToken) eliminarSesionOtp(sessionToken);
  res.json({ success: true });
}

module.exports = {
  getStatus,
  setup,
  verifySetup,
  verifyLogin,
  disable,
  otpAppLogin,
  otpAppLink,
  otpAppConfirmLink,
  otpAppUnlink,
  otpAppLogout,
};
