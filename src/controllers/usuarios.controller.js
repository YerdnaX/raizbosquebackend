const bcrypt = require('bcryptjs');
const { getConnection, sql } = require('../config/db');

const BCRYPT_ROUNDS = 10;
const EXPIRACION_CONTRASENA_DIAS = 120;

function validarPoliticaContrasena(contrasena) {
  const errores = [];
  if (!contrasena || contrasena.length < 6)  errores.push('Mínimo 6 caracteres');
  if (!/[A-Z]/.test(contrasena))             errores.push('Al menos una letra mayúscula');
  if (!/[a-z]/.test(contrasena))             errores.push('Al menos una letra minúscula');
  if (!/[^a-zA-Z0-9]/.test(contrasena))      errores.push('Al menos un símbolo');
  if (/(.)\1/.test(contrasena))              errores.push('No se permiten caracteres idénticos consecutivos');
  return errores;
}

async function actualizarPerfil(req, res) {
  const { id } = req.params;
  const { nombre, apellidos, telefono, direccion } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }

  try {
    const pool = await getConnection();
    await pool.request()
      .input('id',        sql.Int,         id)
      .input('nombre',    sql.VarChar(100), nombre)
      .input('apellidos', sql.VarChar(150), apellidos || '')
      .input('telefono',  sql.VarChar(20),  telefono || '')
      .input('direccion', sql.VarChar(300), direccion || '')
      .query(`
        UPDATE Usuarios
        SET Nombre = @nombre, Apellidos = @apellidos, Telefono = @telefono, Direccion = @direccion
        WHERE IdUsuario = @id
      `);

    res.json({ success: true, mensaje: 'Perfil actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el perfil' });
  }
}

async function cambiarContrasena(req, res) {
  const { id } = req.params;
  const { contrasenaActual, contrasenaNueva } = req.body;

  if (!contrasenaActual || !contrasenaNueva) {
    return res.status(400).json({ error: 'Ambas contraseñas son requeridas' });
  }

  const errores = validarPoliticaContrasena(contrasenaNueva);
  if (errores.length > 0) {
    return res.status(400).json({ codigo: 'INVALID_PASSWORD_POLICY', errores });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT IdUsuario, ContrasenaHash, Contrasena FROM Usuarios WHERE IdUsuario = @id AND Estado = 1');

    if (resultado.recordset.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const u = resultado.recordset[0];

    // Verificar contraseña actual (soporte legado y nuevo hash)
    let ok = false;
    if (u.ContrasenaHash) {
      ok = await bcrypt.compare(contrasenaActual, u.ContrasenaHash);
    } else if (u.Contrasena) {
      ok = (contrasenaActual === u.Contrasena);
    }

    if (!ok) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    const contrasenaHash = await bcrypt.hash(contrasenaNueva, BCRYPT_ROUNDS);
    const ahora          = new Date();
    const expiracion     = new Date(ahora.getTime() + EXPIRACION_CONTRASENA_DIAS * 86400000);

    await pool.request()
      .input('id',           sql.Int,         id)
      .input('hash',         sql.VarChar(255), contrasenaHash)
      .input('fechaCreacion',sql.DateTime,     ahora)
      .input('fechaExpira',  sql.DateTime,     expiracion)
      .query(`
        UPDATE Usuarios
        SET ContrasenaHash            = @hash,
            FechaCreacionContrasena   = @fechaCreacion,
            FechaExpiracionContrasena = @fechaExpira
        WHERE IdUsuario = @id
      `);

    // Auditoría
    try {
      await pool.request()
        .input('idUsuario', sql.Int,         u.IdUsuario)
        .input('fechaExp',  sql.DateTime,    expiracion)
        .input('motivo',    sql.VarChar(100), 'MANUAL')
        .query(`
          INSERT INTO AuditoriaContrasena (IdUsuario, FechaExpiracionNueva, EstadoBloqueoPrevio, EstadoBloqueoPosterior, Motivo)
          VALUES (@idUsuario, @fechaExp, 0, 0, @motivo)
        `);
    } catch (_) {}

    res.json({ success: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
}

module.exports = { actualizarPerfil, cambiarContrasena };
