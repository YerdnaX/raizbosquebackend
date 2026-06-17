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

module.exports = { actualizarPerfil };
