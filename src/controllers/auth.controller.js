const { getConnection, sql } = require('../config/db');

async function login(req, res) {
  const { correo, contrasena } = req.body;

  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('correo', sql.VarChar, correo)
      .input('contrasena', sql.VarChar, contrasena)
      .query(`
        SELECT u.IdUsuario, u.Nombre, u.Apellidos, u.Correo, u.Telefono, u.Direccion, u.Estado,
               r.IdRol, r.NombreRol
        FROM Usuarios u
        INNER JOIN Roles r ON u.IdRol = r.IdRol
        WHERE u.Correo = @correo
          AND u.Contrasena = @contrasena
          AND u.Estado = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const usuario = result.recordset[0];
    res.json({ success: true, usuario });
  } catch (error) {
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

async function registro(req, res) {
  const { nombreCompleto, correo, telefono, contrasena } = req.body;

  if (!nombreCompleto || !correo || !contrasena) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos' });
  }

  try {
    const pool = await getConnection();

    const existe = await pool.request()
      .input('correo', sql.VarChar, correo)
      .query('SELECT IdUsuario FROM Usuarios WHERE Correo = @correo');

    if (existe.recordset.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }

    await pool.request()
      .input('nombre', sql.VarChar, nombreCompleto)
      .input('correo', sql.VarChar, correo)
      .input('telefono', sql.VarChar, telefono || '')
      .input('contrasena', sql.VarChar, contrasena)
      .query(`
        INSERT INTO Usuarios (IdRol, Nombre, Apellidos, Correo, Telefono, Contrasena)
        VALUES (1, @nombre, '', @correo, @telefono, @contrasena)
      `);

    res.status(201).json({ success: true, mensaje: 'Cuenta creada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear la cuenta' });
  }
}

module.exports = { login, registro };
