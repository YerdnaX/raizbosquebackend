const { getConnection, sql } = require('../config/db');

async function actualizarPerfil(req, res) {
  const { id } = req.params;
  const { nombre, apellidos, telefono, direccion } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }

  try {
    const pool = await getConnection();
    await pool.request()
      .input('id', sql.Int, id)
      .input('nombre', sql.VarChar, nombre)
      .input('apellidos', sql.VarChar, apellidos || '')
      .input('telefono', sql.VarChar, telefono || '')
      .input('direccion', sql.VarChar, direccion || '')
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

  if (contrasenaNueva.length < 4) {
    return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 4 caracteres' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id', sql.Int, id)
      .input('contrasena', sql.VarChar, contrasenaActual)
      .query('SELECT IdUsuario FROM Usuarios WHERE IdUsuario = @id AND Contrasena = @contrasena AND Estado = 1');

    if (resultado.recordset.length === 0) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    await pool.request()
      .input('id', sql.Int, id)
      .input('contrasenaNueva', sql.VarChar, contrasenaNueva)
      .query('UPDATE Usuarios SET Contrasena = @contrasenaNueva WHERE IdUsuario = @id');

    res.json({ success: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
}

module.exports = { actualizarPerfil, cambiarContrasena };
