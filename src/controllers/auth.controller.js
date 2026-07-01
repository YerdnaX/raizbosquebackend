const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getConnection, sql } = require('../config/db');
const {
  enviarCodigoVerificacion,
  enviarCodigoRecuperacion: emailEnviarCodigoRecuperacion,
  enviarNombreUsuario,
} = require('../services/emailService');

const BCRYPT_ROUNDS = 10;
const EXPIRACION_CONTRASENA_DIAS = 120;
const EXPIRACION_CODIGO_HORAS = 1;
const MAX_INTENTOS_FALLIDOS = 3;
const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS) || 25000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generarCodigo6Digitos() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sha256(texto) {
  return crypto.createHash('sha256').update(texto).digest('hex');
}

function generarToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: sha256(raw) };
}

async function withTimeout(promise, ms, timeoutMessage = 'Operación excedió el tiempo límite') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function validarPoliticaContrasena(contrasena) {
  const errores = [];
  if (!contrasena || contrasena.length < 6)      errores.push('Mínimo 6 caracteres');
  if (!/[A-Z]/.test(contrasena))                 errores.push('Al menos una letra mayúscula');
  if (!/[a-z]/.test(contrasena))                 errores.push('Al menos una letra minúscula');
  if (!/[^a-zA-Z0-9]/.test(contrasena))          errores.push('Al menos un símbolo');
  if (/(.)\1/.test(contrasena))                  errores.push('No se permiten caracteres idénticos consecutivos');
  return errores;
}

function validarNombreUsuario(nombreUsuario) {
  const errores = [];
  if (!nombreUsuario || nombreUsuario.length < 6)       errores.push('Mínimo 6 caracteres');
  if (!/^[a-zA-Z0-9]+$/.test(nombreUsuario))            errores.push('Solo letras y números, sin espacios ni símbolos');
  return errores;
}

function extraerIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}

async function registrarLoginAuditoria(pool, { idUsuario, correoIngresado, resultado, motivo, ip, userAgent }) {
  try {
    await pool.request()
      .input('idUsuario',      sql.Int,         idUsuario || null)
      .input('correoIngresado',sql.VarChar(150), correoIngresado || null)
      .input('resultado',      sql.VarChar(50),  resultado)
      .input('motivo',         sql.VarChar(200), motivo || null)
      .input('ip',             sql.VarChar(45),  ip || null)
      .input('userAgent',      sql.VarChar(500), userAgent || null)
      .query(`
        INSERT INTO AuditoriaLogin (IdUsuario, CorreoIngresado, Resultado, Motivo, DireccionIP, UserAgent)
        VALUES (@idUsuario, @correoIngresado, @resultado, @motivo, @ip, @userAgent)
      `);
  } catch (_) { /* no bloquear el flujo principal por fallo de auditoría */ }
}

async function registrarCambioContrasena(pool, { idUsuario, fechaExpiracion, bloquePrevio, bloquePost, motivo }) {
  try {
    await pool.request()
      .input('idUsuario',     sql.Int,      idUsuario)
      .input('fechaExp',      sql.DateTime, fechaExpiracion)
      .input('bloquePrevio',  sql.Bit,      bloquePrevio ?? null)
      .input('bloquePost',    sql.Bit,      bloquePost ?? null)
      .input('motivo',        sql.VarChar(100), motivo || null)
      .query(`
        INSERT INTO AuditoriaContrasena
          (IdUsuario, FechaExpiracionNueva, EstadoBloqueoPrevio, EstadoBloqueoPosterior, Motivo)
        VALUES (@idUsuario, @fechaExp, @bloquePrevio, @bloquePost, @motivo)
      `);
  } catch (_) {}
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

async function login(req, res) {
  const { identificador, contrasena } = req.body;
  const ip        = extraerIP(req);
  const userAgent = req.headers['user-agent'] || null;

  if (!identificador || !contrasena) {
    return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'Identificador y contraseña son requeridos' });
  }

  try {
    const pool = await getConnection();

    // Buscar por correo o nombre de usuario
    const busqueda = await pool.request()
      .input('id', sql.VarChar(150), identificador)
      .query(`
        SELECT IdUsuario, Nombre, Apellidos, Correo, NombreUsuario, Telefono, Direccion,
               Estado, ContrasenaHash, Contrasena,
               FechaExpiracionContrasena, IntentosFallidos, CuentaBloqueada,
               IdRol, TwoFactorEnabled, TwoFactorMethod
        FROM Usuarios
        WHERE (Correo = @id OR LOWER(NombreUsuario) = LOWER(@id))
          AND Estado = 1
      `);

    if (busqueda.recordset.length === 0) {
      // No revelar si el correo/usuario existe
      await registrarLoginAuditoria(pool, { correoIngresado: identificador, resultado: 'FALLIDO', motivo: 'Usuario no encontrado', ip, userAgent });
      return res.status(401).json({ codigo: 'INVALID_CREDENTIALS', error: 'Credenciales incorrectas' });
    }

    const u = busqueda.recordset[0];

    // Verificar bloqueo ANTES de validar la contraseña
    if (u.CuentaBloqueada) {
      await registrarLoginAuditoria(pool, { idUsuario: u.IdUsuario, correoIngresado: identificador, resultado: 'INTENTO_BLOQUEADA', motivo: 'Cuenta bloqueada', ip, userAgent });
      return res.status(403).json({ codigo: 'ACCOUNT_LOCKED', error: 'Cuenta bloqueada. Debes recuperar tu contraseña para desbloquearla.' });
    }

    // Verificar contraseña (hash o texto plano para migración)
    let contrasenaOk = false;
    if (u.ContrasenaHash) {
      contrasenaOk = await bcrypt.compare(contrasena, u.ContrasenaHash);
    } else if (u.Contrasena) {
      contrasenaOk = (contrasena === u.Contrasena);
    }

    if (!contrasenaOk) {
      const nuevosIntentos = (u.IntentosFallidos || 0) + 1;
      let bloqueada = false;

      if (nuevosIntentos >= MAX_INTENTOS_FALLIDOS) {
        bloqueada = true;
        await pool.request()
          .input('id', sql.Int, u.IdUsuario)
          .query(`
            UPDATE Usuarios
            SET IntentosFallidos = ${nuevosIntentos},
                CuentaBloqueada  = 1,
                FechaBloqueo     = GETDATE()
            WHERE IdUsuario = @id
          `);
        await registrarLoginAuditoria(pool, { idUsuario: u.IdUsuario, correoIngresado: identificador, resultado: 'BLOQUEADO', motivo: 'Tercer intento fallido — cuenta bloqueada', ip, userAgent });
        return res.status(403).json({ codigo: 'ACCOUNT_LOCKED', error: 'Cuenta bloqueada tras tres intentos fallidos. Recupera tu contraseña para continuar.' });
      } else {
        await pool.request()
          .input('id',       sql.Int, u.IdUsuario)
          .input('intentos', sql.Int, nuevosIntentos)
          .query('UPDATE Usuarios SET IntentosFallidos = @intentos WHERE IdUsuario = @id');
        await registrarLoginAuditoria(pool, { idUsuario: u.IdUsuario, correoIngresado: identificador, resultado: 'FALLIDO', motivo: `Intento ${nuevosIntentos} fallido`, ip, userAgent });
        return res.status(401).json({ codigo: 'INVALID_CREDENTIALS', error: 'Credenciales incorrectas', intentoNumero: nuevosIntentos });
      }
    }

    // Contraseña correcta → resetear intentos
    await pool.request()
      .input('id', sql.Int, u.IdUsuario)
      .query('UPDATE Usuarios SET IntentosFallidos = 0 WHERE IdUsuario = @id');

    // Verificar vigencia de contraseña
    if (u.FechaExpiracionContrasena && new Date() > new Date(u.FechaExpiracionContrasena)) {
      await registrarLoginAuditoria(pool, { idUsuario: u.IdUsuario, correoIngresado: identificador, resultado: 'FALLIDO', motivo: 'Contraseña vencida', ip, userAgent });
      return res.status(403).json({ codigo: 'PASSWORD_EXPIRED', error: 'Tu contraseña ha vencido. Debes crear una nueva.', correo: u.Correo });
    }

    // Si el usuario tiene 2FA activo, no entregar sesión aún
    if (u.TwoFactorEnabled) {
      return res.json({ requires2FA: true, userId: u.IdUsuario, method: u.TwoFactorMethod, message: 'Código 2FA requerido' });
    }

    // Obtener rol
    const rolRes = await pool.request()
      .input('idRol', sql.Int, u.IdRol)
      .query('SELECT NombreRol FROM Roles WHERE IdRol = @idRol');
    const nombreRol = rolRes.recordset[0]?.NombreRol || '';

    await registrarLoginAuditoria(pool, { idUsuario: u.IdUsuario, correoIngresado: identificador, resultado: 'EXITOSO', motivo: null, ip, userAgent });

    res.json({
      success: true,
      usuario: {
        IdUsuario: u.IdUsuario,
        Nombre: u.Nombre,
        Apellidos: u.Apellidos,
        Correo: u.Correo,
        NombreUsuario: u.NombreUsuario,
        Telefono: u.Telefono,
        Direccion: u.Direccion,
        Estado: u.Estado,
        IdRol: u.IdRol,
        NombreRol:    nombreRol,
        TieneTotp2FA: false,
        MetodoTotp2FA:null,
      },
    });
  } catch (error) {
    console.error('[auth.login]', error.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al iniciar sesión' });
  }
}

// ─── POST /api/auth/registro/enviar-codigo ────────────────────────────────────

async function enviarCodigoRegistro(req, res) {
  const { correo } = req.body;
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ codigo: 'CORREO_INVALIDO', error: 'Correo electrónico inválido' });
  }

  try {
    const pool = await getConnection();

    // Verificar que el correo no esté ya registrado
    const existe = await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query('SELECT IdUsuario FROM Usuarios WHERE Correo = @correo AND Estado = 1');
    if (existe.recordset.length > 0) {
      return res.status(409).json({ codigo: 'EMAIL_ALREADY_EXISTS', error: 'Ya existe una cuenta con ese correo' });
    }

    // Invalidar códigos anteriores del mismo correo
    await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query("UPDATE CodigosVerificacion SET Usado = 1 WHERE Correo = @correo AND Tipo = 'REGISTRO' AND Usado = 0");

    const codigo = generarCodigo6Digitos();
    const codigoHash = await bcrypt.hash(codigo, BCRYPT_ROUNDS);
    const expira = new Date(Date.now() + EXPIRACION_CODIGO_HORAS * 3600000);

    await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .input('hash',   sql.VarChar(255), codigoHash)
      .input('expira', sql.DateTime,     expira)
      .query(`
        INSERT INTO CodigosVerificacion (Correo, CodigoHash, Tipo, FechaExpiracion)
        VALUES (@correo, @hash, 'REGISTRO', @expira)
      `);

    try {
      await withTimeout(
        enviarCodigoVerificacion(correo, codigo),
        EMAIL_TIMEOUT_MS,
        `Timeout enviando correo (${EMAIL_TIMEOUT_MS}ms)`,
      );
    } catch (emailError) {
      console.error('[auth.enviarCodigoRegistro] ERROR DE EMAIL:', emailError.message);
      console.error('[auth.enviarCodigoRegistro] EMAIL CODE:', emailError.code || 'SIN_CODIGO');
      console.error('[auth.enviarCodigoRegistro] EMAIL COMMAND:', emailError.command || 'SIN_COMMAND');
      console.error('[auth.enviarCodigoRegistro] EMAIL STACK:', emailError.stack);
      const detalle = emailError?.message || 'Error al enviar correo';
      const esProblemaRedSmtp = (emailError?.code === 'ESOCKET') || /ENETUNREACH|ECONNREFUSED|ETIMEDOUT/i.test(detalle);
      if (esProblemaRedSmtp) {
        return res.status(503).json({
          codigo: 'EMAIL_NETWORK_ERROR',
          error: 'No fue posible conectar al servidor de correo.',
          detalle,
        });
      }
      return res.status(500).json({ codigo: 'EMAIL_ERROR', error: 'No se pudo enviar el correo. Intente más tarde.', detalle });
    }

    res.json({ success: true, mensaje: 'Código enviado al correo' });
  } catch (error) {
    console.error('[auth.enviarCodigoRegistro] ERROR DE BASE DE DATOS:', error.message);
    console.error('[auth.enviarCodigoRegistro] DB STACK:', error.stack);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error interno del servidor', detalle: error.message });
  }
}

// ─── POST /api/auth/registro/verificar-codigo ────────────────────────────────

async function verificarCodigoRegistro(req, res) {
  const { correo, codigo } = req.body;
  if (!correo || !codigo) {
    return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'Correo y código son requeridos' });
  }

  try {
    const pool = await getConnection();

    const registros = await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query(`
        SELECT TOP 1 IdCodigo, CodigoHash, FechaExpiracion, Usado
        FROM CodigosVerificacion
        WHERE Correo = @correo AND Tipo = 'REGISTRO' AND Usado = 0
        ORDER BY FechaCreacion DESC
      `);

    if (registros.recordset.length === 0) {
      return res.status(400).json({ codigo: 'INVALID_CODE', error: 'Código inválido o ya utilizado' });
    }

    const rec = registros.recordset[0];

    if (new Date() > new Date(rec.FechaExpiracion)) {
      return res.status(400).json({ codigo: 'EXPIRED_CODE', error: 'El código ha vencido. Solicita uno nuevo.' });
    }

    const codigoValido = await bcrypt.compare(codigo, rec.CodigoHash);
    if (!codigoValido) {
      return res.status(400).json({ codigo: 'INVALID_CODE', error: 'El código ingresado es incorrecto' });
    }

    // Marcar código como usado
    await pool.request()
      .input('id', sql.Int, rec.IdCodigo)
      .query('UPDATE CodigosVerificacion SET Usado = 1 WHERE IdCodigo = @id');

    // Generar token de registro para los siguientes pasos
    const { raw: token, hash: tokenHash } = generarToken();
    const expiraToken = new Date(Date.now() + EXPIRACION_CODIGO_HORAS * 3600000);

    // Invalidar tokens anteriores del mismo correo
    await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query("UPDATE TokensTemporal SET Usado = 1 WHERE Correo = @correo AND Tipo = 'REGISTRO' AND Usado = 0");

    await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .input('hash',   sql.VarChar(255), tokenHash)
      .input('expira', sql.DateTime,     expiraToken)
      .query(`
        INSERT INTO TokensTemporal (Correo, TokenHash, Tipo, FechaExpiracion)
        VALUES (@correo, @hash, 'REGISTRO', @expira)
      `);

    res.json({ success: true, token, mensaje: 'Correo verificado correctamente' });
  } catch (error) {
    console.error('[auth.verificarCodigoRegistro]', error.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al verificar el código' });
  }
}

// ─── GET /api/auth/registro/verificar-usuario?nombreUsuario=xxx ───────────────

async function verificarNombreUsuario(req, res) {
  const { nombreUsuario } = req.query;
  if (!nombreUsuario) {
    return res.status(400).json({ codigo: 'CAMPO_REQUERIDO', error: 'Nombre de usuario requerido' });
  }

  const errores = validarNombreUsuario(nombreUsuario);
  if (errores.length > 0) {
    return res.status(400).json({ codigo: 'INVALID_USERNAME', errores });
  }

  try {
    const pool = await getConnection();
    const existe = await pool.request()
      .input('nombre', sql.VarChar(100), nombreUsuario)
      .query('SELECT IdUsuario FROM Usuarios WHERE LOWER(NombreUsuario) = LOWER(@nombre)');

    if (existe.recordset.length > 0) {
      return res.status(409).json({ codigo: 'USERNAME_ALREADY_EXISTS', error: 'Nombre de usuario ya en uso' });
    }

    res.json({ success: true, disponible: true, mensaje: 'Nombre de usuario disponible' });
  } catch (error) {
    console.error('[auth.verificarNombreUsuario]', error.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al verificar el nombre de usuario' });
  }
}

// ─── GET /api/auth/preguntas-seguridad ───────────────────────────────────────

async function getPreguntasSeguridad(req, res) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT IdPregunta, TextoPregunta FROM PreguntasSeguridad ORDER BY IdPregunta');
    res.json({ preguntas: result.recordset });
  } catch (error) {
    console.error('[auth.getPreguntasSeguridad]', error.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al obtener preguntas de seguridad' });
  }
}

// ─── POST /api/auth/registro/completar ───────────────────────────────────────

async function completarRegistro(req, res) {
  const { correo, token, nombre, apellidos, telefono, direccion, nombreUsuario, contrasena, respuesta1, respuesta2, respuesta3 } = req.body;

  if (!correo || !token || !nombre || !apellidos || !nombreUsuario || !contrasena || !respuesta1 || !respuesta2 || !respuesta3) {
    return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'Todos los campos son requeridos' });
  }

  // Validar política de contraseña
  const erroresContrasena = validarPoliticaContrasena(contrasena);
  if (erroresContrasena.length > 0) {
    return res.status(400).json({ codigo: 'INVALID_PASSWORD_POLICY', errores: erroresContrasena });
  }

  // Validar nombre de usuario
  const erroresUsuario = validarNombreUsuario(nombreUsuario);
  if (erroresUsuario.length > 0) {
    return res.status(400).json({ codigo: 'INVALID_USERNAME', errores: erroresUsuario });
  }

  if (!/^\d{8}$/.test(telefono || '')) {
    return res.status(400).json({ codigo: 'TELEFONO_INVALIDO', error: 'El teléfono debe tener 8 dígitos' });
  }

  try {
    const pool = await getConnection();

    // Verificar token
    const tokenHash = sha256(token);
    const tokenRec = await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .input('hash',   sql.VarChar(255), tokenHash)
      .query(`
        SELECT TOP 1 IdToken, FechaExpiracion, Usado
        FROM TokensTemporal
        WHERE Correo = @correo AND TokenHash = @hash AND Tipo = 'REGISTRO' AND Usado = 0
      `);

    if (tokenRec.recordset.length === 0) {
      return res.status(400).json({ codigo: 'INVALID_CODE', error: 'Token de registro inválido o expirado' });
    }

    const tok = tokenRec.recordset[0];
    if (new Date() > new Date(tok.FechaExpiracion)) {
      return res.status(400).json({ codigo: 'EXPIRED_CODE', error: 'La sesión de registro ha expirado. Inicia el proceso nuevamente.' });
    }

    // Verificar unicidad de correo y nombre de usuario
    const unicidad = await pool.request()
      .input('correo',  sql.VarChar(150), correo)
      .input('usuario', sql.VarChar(100), nombreUsuario)
      .query(`
        SELECT
          (SELECT COUNT(1) FROM Usuarios WHERE Correo = @correo) AS correoExiste,
          (SELECT COUNT(1) FROM Usuarios WHERE LOWER(NombreUsuario) = LOWER(@usuario)) AS usuarioExiste
      `);

    if (unicidad.recordset[0].correoExiste > 0) {
      return res.status(409).json({ codigo: 'EMAIL_ALREADY_EXISTS', error: 'Ya existe una cuenta con ese correo' });
    }
    if (unicidad.recordset[0].usuarioExiste > 0) {
      return res.status(409).json({ codigo: 'USERNAME_ALREADY_EXISTS', error: 'El nombre de usuario ya está en uso' });
    }

    // Hash de contraseña y respuestas
    const contrasenaHash  = await bcrypt.hash(contrasena, BCRYPT_ROUNDS);
    const respuesta1Hash  = await bcrypt.hash(respuesta1, BCRYPT_ROUNDS);
    const respuesta2Hash  = await bcrypt.hash(respuesta2, BCRYPT_ROUNDS);
    const respuesta3Hash  = await bcrypt.hash(respuesta3, BCRYPT_ROUNDS);

    const ahora          = new Date();
    const expiracionContr = new Date(ahora.getTime() + EXPIRACION_CONTRASENA_DIAS * 86400000);

    // Transacción: crear usuario + respuestas + marcar token
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      const insertResult = await transaction.request()
        .input('nombre',        sql.VarChar(100), nombre)
        .input('apellidos',     sql.VarChar(150), apellidos)
        .input('correo',        sql.VarChar(150), correo)
        .input('telefono',      sql.VarChar(20),  telefono || '')
        .input('direccion',     sql.VarChar(300), direccion || '')
        .input('nombreUsuario', sql.VarChar(100), nombreUsuario)
        .input('contraHash',    sql.VarChar(255), contrasenaHash)
        .input('fechaCreacion', sql.DateTime,     ahora)
        .input('fechaExpira',   sql.DateTime,     expiracionContr)
        .query(`
          INSERT INTO Usuarios
            (IdRol, Nombre, Apellidos, Correo, Telefono, Direccion,
             NombreUsuario, ContrasenaHash, FechaCreacionContrasena,
             FechaExpiracionContrasena, IntentosFallidos, CuentaBloqueada, CorreoVerificado, Estado)
          OUTPUT INSERTED.IdUsuario
          VALUES
            (1, @nombre, @apellidos, @correo, @telefono, @direccion,
             @nombreUsuario, @contraHash, @fechaCreacion,
             @fechaExpira, 0, 0, 1, 1)
        `);

      const idUsuario = insertResult.recordset[0].IdUsuario;

      // Insertar respuestas de seguridad
      await transaction.request()
        .input('idUsuario', sql.Int,         idUsuario)
        .input('r1hash',    sql.VarChar(255), respuesta1Hash)
        .input('r2hash',    sql.VarChar(255), respuesta2Hash)
        .input('r3hash',    sql.VarChar(255), respuesta3Hash)
        .query(`
          INSERT INTO RespuestasSeguridad (IdUsuario, IdPregunta, RespuestaHash)
          VALUES (@idUsuario, 1, @r1hash),
                 (@idUsuario, 2, @r2hash),
                 (@idUsuario, 3, @r3hash)
        `);

      // Marcar token como usado
      await transaction.request()
        .input('idToken', sql.Int, tok.IdToken)
        .query('UPDATE TokensTemporal SET Usado = 1 WHERE IdToken = @idToken');

      await transaction.commit();

      // Auditoría de contraseña inicial
      await registrarCambioContrasena(pool, {
        idUsuario,
        fechaExpiracion: expiracionContr,
        bloquePrevio: 0,
        bloquePost: 0,
        motivo: 'REGISTRO',
      });

      res.status(201).json({ success: true, mensaje: 'Cuenta creada correctamente' });
    } catch (innerError) {
      await transaction.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error('[auth.completarRegistro]', error.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al crear la cuenta' });
  }
}

// ─── POST /api/auth/recuperar-contrasena/enviar-codigo ───────────────────────

async function enviarCodigoRecuperacion(req, res) {
  const { correo } = req.body;
  if (!correo) {
    return res.status(400).json({ codigo: 'CAMPO_REQUERIDO', error: 'Correo requerido' });
  }

  try {
    const pool = await getConnection();

    // No revelar si el correo existe; siempre responder igual
    const existe = await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query('SELECT IdUsuario FROM Usuarios WHERE Correo = @correo AND Estado = 1');

    if (existe.recordset.length > 0) {
      // Invalidar códigos anteriores
      await pool.request()
        .input('correo', sql.VarChar(150), correo)
        .query("UPDATE CodigosVerificacion SET Usado = 1 WHERE Correo = @correo AND Tipo = 'RECUPERACION' AND Usado = 0");

      const codigo     = generarCodigo6Digitos();
      const codigoHash = await bcrypt.hash(codigo, BCRYPT_ROUNDS);
      const expira     = new Date(Date.now() + EXPIRACION_CODIGO_HORAS * 3600000);

      await pool.request()
        .input('correo', sql.VarChar(150), correo)
        .input('hash',   sql.VarChar(255), codigoHash)
        .input('expira', sql.DateTime,     expira)
        .query(`
          INSERT INTO CodigosVerificacion (Correo, CodigoHash, Tipo, FechaExpiracion)
          VALUES (@correo, @hash, 'RECUPERACION', @expira)
        `);

      await withTimeout(
        emailEnviarCodigoRecuperacion(correo, codigo),
        EMAIL_TIMEOUT_MS,
        `Timeout enviando correo (${EMAIL_TIMEOUT_MS}ms)`,
      );
    }

    // Respuesta idéntica independientemente de si el correo existe o no
    res.json({ success: true, mensaje: 'Si el correo está registrado, recibirás un código.' });
  } catch (error) {
    console.error('[auth.enviarCodigoRecuperacion]', error.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al enviar el código de recuperación' });
  }
}

// ─── POST /api/auth/recuperar-contrasena/verificar-codigo ────────────────────

async function verificarCodigoRecuperacion(req, res) {
  const { correo, codigo } = req.body;
  if (!correo || !codigo) {
    return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'Correo y código son requeridos' });
  }

  try {
    const pool = await getConnection();

    const registros = await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query(`
        SELECT TOP 1 IdCodigo, CodigoHash, FechaExpiracion
        FROM CodigosVerificacion
        WHERE Correo = @correo AND Tipo = 'RECUPERACION' AND Usado = 0
        ORDER BY FechaCreacion DESC
      `);

    if (registros.recordset.length === 0) {
      return res.status(400).json({ codigo: 'INVALID_CODE', error: 'Código inválido o ya utilizado' });
    }

    const rec = registros.recordset[0];
    if (new Date() > new Date(rec.FechaExpiracion)) {
      return res.status(400).json({ codigo: 'EXPIRED_CODE', error: 'El código ha vencido. Solicita uno nuevo.' });
    }

    const codigoValido = await bcrypt.compare(codigo, rec.CodigoHash);
    if (!codigoValido) {
      return res.status(400).json({ codigo: 'INVALID_CODE', error: 'El código ingresado es incorrecto' });
    }

    await pool.request()
      .input('id', sql.Int, rec.IdCodigo)
      .query('UPDATE CodigosVerificacion SET Usado = 1 WHERE IdCodigo = @id');

    const { raw: token, hash: tokenHash } = generarToken();
    const expiraToken = new Date(Date.now() + EXPIRACION_CODIGO_HORAS * 3600000);

    await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query("UPDATE TokensTemporal SET Usado = 1 WHERE Correo = @correo AND Tipo = 'RECUPERACION_CORREO' AND Usado = 0");

    await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .input('hash',   sql.VarChar(255), tokenHash)
      .input('expira', sql.DateTime,     expiraToken)
      .query(`
        INSERT INTO TokensTemporal (Correo, TokenHash, Tipo, FechaExpiracion)
        VALUES (@correo, @hash, 'RECUPERACION_CORREO', @expira)
      `);

    res.json({ success: true, token, mensaje: 'Código verificado correctamente' });
  } catch (error) {
    console.error('[auth.verificarCodigoRecuperacion]', error.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al verificar el código' });
  }
}

// ─── POST /api/auth/recuperar-contrasena/preguntas ───────────────────────────
// Devuelve 2 preguntas de seguridad del usuario (por correo)

async function obtenerPreguntasRecuperacion(req, res) {
  const { correo } = req.body;
  if (!correo) {
    return res.status(400).json({ codigo: 'CAMPO_REQUERIDO', error: 'Correo requerido' });
  }

  try {
    const pool = await getConnection();

    const user = await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query('SELECT IdUsuario FROM Usuarios WHERE Correo = @correo AND Estado = 1');

    // Respuesta genérica si no existe el correo (no revelar)
    if (user.recordset.length === 0) {
      return res.status(404).json({ codigo: 'USER_NOT_FOUND', error: 'No se encontraron preguntas para ese correo' });
    }

    const idUsuario = user.recordset[0].IdUsuario;

    const preguntas = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .query(`
        SELECT TOP 2 ps.IdPregunta, ps.TextoPregunta
        FROM RespuestasSeguridad rs
        INNER JOIN PreguntasSeguridad ps ON rs.IdPregunta = ps.IdPregunta
        WHERE rs.IdUsuario = @idUsuario
        ORDER BY ps.IdPregunta ASC
      `);

    if (preguntas.recordset.length < 2) {
      return res.status(400).json({ codigo: 'NO_SECURITY_QUESTIONS', error: 'El usuario no tiene preguntas de seguridad configuradas' });
    }

    res.json({ preguntas: preguntas.recordset });
  } catch (error) {
    console.error('[auth.obtenerPreguntasRecuperacion]', error.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al obtener las preguntas' });
  }
}

// ─── POST /api/auth/recuperar-contrasena/verificar-respuestas ────────────────

async function verificarRespuestasSeguridad(req, res) {
  const { correo, respuesta1, respuesta2 } = req.body;
  if (!correo || !respuesta1 || !respuesta2) {
    return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'Correo y ambas respuestas son requeridos' });
  }

  try {
    const pool = await getConnection();

    const user = await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query('SELECT IdUsuario FROM Usuarios WHERE Correo = @correo AND Estado = 1');

    if (user.recordset.length === 0) {
      return res.status(401).json({ codigo: 'SECURITY_ANSWER_INVALID', error: 'Las respuestas no coinciden' });
    }

    const idUsuario = user.recordset[0].IdUsuario;

    const respuestasDB = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .query(`
        SELECT IdPregunta, RespuestaHash
        FROM RespuestasSeguridad
        WHERE IdUsuario = @idUsuario AND IdPregunta IN (1, 2)
        ORDER BY IdPregunta ASC
      `);

    if (respuestasDB.recordset.length < 2) {
      return res.status(401).json({ codigo: 'SECURITY_ANSWER_INVALID', error: 'Las respuestas no coinciden' });
    }

    const r1ok = await bcrypt.compare(respuesta1, respuestasDB.recordset[0].RespuestaHash);
    const r2ok = await bcrypt.compare(respuesta2, respuestasDB.recordset[1].RespuestaHash);

    if (!r1ok || !r2ok) {
      return res.status(401).json({ codigo: 'SECURITY_ANSWER_INVALID', error: 'Las respuestas no coinciden' });
    }

    const { raw: token, hash: tokenHash } = generarToken();
    const expiraToken = new Date(Date.now() + EXPIRACION_CODIGO_HORAS * 3600000);

    await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query("UPDATE TokensTemporal SET Usado = 1 WHERE Correo = @correo AND Tipo = 'RECUPERACION_PREGUNTAS' AND Usado = 0");

    await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .input('hash',   sql.VarChar(255), tokenHash)
      .input('expira', sql.DateTime,     expiraToken)
      .query(`
        INSERT INTO TokensTemporal (Correo, TokenHash, Tipo, FechaExpiracion)
        VALUES (@correo, @hash, 'RECUPERACION_PREGUNTAS', @expira)
      `);

    res.json({ success: true, token, mensaje: 'Respuestas verificadas correctamente' });
  } catch (error) {
    console.error('[auth.verificarRespuestasSeguridad]', error.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al verificar las respuestas' });
  }
}

// ─── POST /api/auth/recuperar-contrasena/nueva-contrasena ────────────────────

async function establecerNuevaContrasena(req, res) {
  const { correo, token, tipo, contrasenaNueva } = req.body;
  if (!correo || !token || !tipo || !contrasenaNueva) {
    return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'Todos los campos son requeridos' });
  }

  const errores = validarPoliticaContrasena(contrasenaNueva);
  if (errores.length > 0) {
    return res.status(400).json({ codigo: 'INVALID_PASSWORD_POLICY', errores });
  }

  try {
    const pool = await getConnection();

    const tokenHash = sha256(token);
    const tokenRec  = await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .input('hash',   sql.VarChar(255), tokenHash)
      .input('tipo',   sql.VarChar(50),  tipo)
      .query(`
        SELECT TOP 1 IdToken, FechaExpiracion
        FROM TokensTemporal
        WHERE Correo = @correo AND TokenHash = @hash AND Tipo = @tipo AND Usado = 0
      `);

    if (tokenRec.recordset.length === 0) {
      return res.status(400).json({ codigo: 'INVALID_CODE', error: 'Token de recuperación inválido o expirado' });
    }

    if (new Date() > new Date(tokenRec.recordset[0].FechaExpiracion)) {
      return res.status(400).json({ codigo: 'EXPIRED_CODE', error: 'El token de recuperación ha expirado. Inicia el proceso nuevamente.' });
    }

    const user = await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query('SELECT IdUsuario, CuentaBloqueada FROM Usuarios WHERE Correo = @correo AND Estado = 1');

    if (user.recordset.length === 0) {
      return res.status(404).json({ codigo: 'USER_NOT_FOUND', error: 'Usuario no encontrado' });
    }

    const { IdUsuario, CuentaBloqueada } = user.recordset[0];
    const contrasenaHash  = await bcrypt.hash(contrasenaNueva, BCRYPT_ROUNDS);
    const ahora           = new Date();
    const expiracion      = new Date(ahora.getTime() + EXPIRACION_CONTRASENA_DIAS * 86400000);

    const transaction = pool.transaction();
    await transaction.begin();
    try {
      await transaction.request()
        .input('id',           sql.Int,         IdUsuario)
        .input('hash',         sql.VarChar(255), contrasenaHash)
        .input('fechaCreacion',sql.DateTime,     ahora)
        .input('fechaExpira',  sql.DateTime,     expiracion)
        .query(`
          UPDATE Usuarios
          SET ContrasenaHash              = @hash,
              FechaCreacionContrasena     = @fechaCreacion,
              FechaExpiracionContrasena   = @fechaExpira,
              IntentosFallidos            = 0,
              CuentaBloqueada             = 0,
              FechaBloqueo                = NULL
          WHERE IdUsuario = @id
        `);

      await transaction.request()
        .input('idToken', sql.Int, tokenRec.recordset[0].IdToken)
        .query('UPDATE TokensTemporal SET Usado = 1 WHERE IdToken = @idToken');

      await transaction.commit();

      await registrarCambioContrasena(pool, {
        idUsuario: IdUsuario,
        fechaExpiracion: expiracion,
        bloquePrevio: CuentaBloqueada,
        bloquePost: 0,
        motivo: tipo === 'RECUPERACION_CORREO' ? 'RECUPERACION_CORREO' : 'RECUPERACION_PREGUNTAS',
      });

      res.json({ codigo: 'RECOVERY_COMPLETED', success: true, mensaje: 'Contraseña actualizada correctamente' });
    } catch (innerError) {
      await transaction.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error('[auth.establecerNuevaContrasena]', error.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al establecer la nueva contraseña' });
  }
}

// ─── POST /api/auth/recuperar-contrasena/vencida ─────────────────────────────
// Cambio de contraseña vencida: el usuario conoce su contraseña actual

async function cambiarContrasenaVencida(req, res) {
  const { correo, contrasenaActual, contrasenaNueva } = req.body;
  if (!correo || !contrasenaActual || !contrasenaNueva) {
    return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'Todos los campos son requeridos' });
  }

  const errores = validarPoliticaContrasena(contrasenaNueva);
  if (errores.length > 0) {
    return res.status(400).json({ codigo: 'INVALID_PASSWORD_POLICY', errores });
  }

  try {
    const pool = await getConnection();

    const user = await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query('SELECT IdUsuario, ContrasenaHash, Contrasena, CuentaBloqueada FROM Usuarios WHERE Correo = @correo AND Estado = 1');

    if (user.recordset.length === 0) {
      return res.status(401).json({ codigo: 'INVALID_CREDENTIALS', error: 'Credenciales incorrectas' });
    }

    const u = user.recordset[0];

    if (u.CuentaBloqueada) {
      return res.status(403).json({ codigo: 'ACCOUNT_LOCKED', error: 'Cuenta bloqueada. Debes recuperar tu contraseña.' });
    }

    let ok = false;
    if (u.ContrasenaHash) {
      ok = await bcrypt.compare(contrasenaActual, u.ContrasenaHash);
    } else if (u.Contrasena) {
      ok = (contrasenaActual === u.Contrasena);
    }

    if (!ok) {
      return res.status(401).json({ codigo: 'INVALID_CREDENTIALS', error: 'La contraseña actual es incorrecta' });
    }

    const contrasenaHash  = await bcrypt.hash(contrasenaNueva, BCRYPT_ROUNDS);
    const ahora           = new Date();
    const expiracion      = new Date(ahora.getTime() + EXPIRACION_CONTRASENA_DIAS * 86400000);

    await pool.request()
      .input('id',           sql.Int,         u.IdUsuario)
      .input('hash',         sql.VarChar(255), contrasenaHash)
      .input('fechaCreacion',sql.DateTime,     ahora)
      .input('fechaExpira',  sql.DateTime,     expiracion)
      .query(`
        UPDATE Usuarios
        SET ContrasenaHash            = @hash,
            FechaCreacionContrasena   = @fechaCreacion,
            FechaExpiracionContrasena = @fechaExpira,
            IntentosFallidos          = 0,
            CuentaBloqueada           = 0
        WHERE IdUsuario = @id
      `);

    await registrarCambioContrasena(pool, {
      idUsuario: u.IdUsuario,
      fechaExpiracion: expiracion,
      bloquePrevio: u.CuentaBloqueada,
      bloquePost: 0,
      motivo: 'VENCIDA',
    });

    res.json({ success: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('[auth.cambiarContrasenaVencida]', error.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al cambiar la contraseña' });
  }
}

// ─── POST /api/auth/recuperar-usuario/pregunta ───────────────────────────────

async function obtenerPreguntaRecuperacionUsuario(req, res) {
  const { correo } = req.body;
  if (!correo) {
    return res.status(400).json({ codigo: 'CAMPO_REQUERIDO', error: 'Correo requerido' });
  }

  try {
    const pool = await getConnection();

    const user = await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query('SELECT IdUsuario FROM Usuarios WHERE Correo = @correo AND Estado = 1');

    // Respuesta genérica (no revelar si correo existe)
    if (user.recordset.length === 0) {
      return res.status(404).json({ codigo: 'USER_NOT_FOUND', error: 'No se encontró una cuenta con ese correo' });
    }

    const idUsuario = user.recordset[0].IdUsuario;

    const pregunta = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .query(`
        SELECT TOP 1 ps.IdPregunta, ps.TextoPregunta
        FROM RespuestasSeguridad rs
        INNER JOIN PreguntasSeguridad ps ON rs.IdPregunta = ps.IdPregunta
        WHERE rs.IdUsuario = @idUsuario
        ORDER BY ps.IdPregunta ASC
      `);

    if (pregunta.recordset.length === 0) {
      return res.status(400).json({ codigo: 'NO_SECURITY_QUESTIONS', error: 'No se encontraron preguntas de seguridad' });
    }

    res.json({ pregunta: pregunta.recordset[0] });
  } catch (error) {
    console.error('[auth.obtenerPreguntaRecuperacionUsuario]', error.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al obtener la pregunta' });
  }
}

// ─── POST /api/auth/recuperar-usuario/verificar-respuesta ────────────────────

async function verificarRespuestaRecuperacionUsuario(req, res) {
  const { correo, respuesta } = req.body;
  if (!correo || !respuesta) {
    return res.status(400).json({ codigo: 'CAMPOS_REQUERIDOS', error: 'Correo y respuesta son requeridos' });
  }

  try {
    const pool = await getConnection();

    const user = await pool.request()
      .input('correo', sql.VarChar(150), correo)
      .query('SELECT IdUsuario, NombreUsuario FROM Usuarios WHERE Correo = @correo AND Estado = 1');

    if (user.recordset.length === 0) {
      return res.status(401).json({ codigo: 'SECURITY_ANSWER_INVALID', error: 'La respuesta no es correcta' });
    }

    const { IdUsuario, NombreUsuario } = user.recordset[0];

    const respuestaDB = await pool.request()
      .input('idUsuario', sql.Int, IdUsuario)
      .query(`
        SELECT TOP 1 RespuestaHash
        FROM RespuestasSeguridad
        WHERE IdUsuario = @idUsuario AND IdPregunta = 1
      `);

    if (respuestaDB.recordset.length === 0) {
      return res.status(401).json({ codigo: 'SECURITY_ANSWER_INVALID', error: 'La respuesta no es correcta' });
    }

    const esValida = await bcrypt.compare(respuesta, respuestaDB.recordset[0].RespuestaHash);
    if (!esValida) {
      return res.status(401).json({ codigo: 'SECURITY_ANSWER_INVALID', error: 'La respuesta no es correcta' });
    }

    // Enviar nombre de usuario al correo (no mostrarlo en respuesta)
    if (NombreUsuario) {
      await enviarNombreUsuario(correo, NombreUsuario);
    }

    res.json({ success: true, mensaje: 'Tu nombre de usuario fue enviado a tu correo' });
  } catch (error) {
    console.error('[auth.verificarRespuestaRecuperacionUsuario]', error.message);
    res.status(500).json({ codigo: 'SERVER_ERROR', error: 'Error al verificar la respuesta' });
  }
}

// ─── Los endpoints 2FA y otp-app están en twoFactor.controller.js ─────────────

module.exports = {
  login,
  enviarCodigoRegistro,
  verificarCodigoRegistro,
  verificarNombreUsuario,
  getPreguntasSeguridad,
  completarRegistro,
  enviarCodigoRecuperacion,
  verificarCodigoRecuperacion,
  obtenerPreguntasRecuperacion,
  verificarRespuestasSeguridad,
  establecerNuevaContrasena,
  cambiarContrasenaVencida,
  obtenerPreguntaRecuperacionUsuario,
  verificarRespuestaRecuperacionUsuario,
};
