const { getConnection, sql } = require('../config/db');

async function obtenerReservaciones(req, res) {
  const { idUsuario } = req.params;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .query(`
        SELECT
          IdReservacion,
          CONVERT(VARCHAR, FechaReservacion, 23) AS FechaReservacion,
          LEFT(CONVERT(VARCHAR, HoraReservacion, 108), 5) AS HoraReservacion,
          CantidadPersonas,
          Estado,
          Comentarios,
          FechaRegistro
        FROM Reservaciones
        WHERE IdUsuario = @idUsuario
        ORDER BY FechaReservacion DESC, HoraReservacion DESC
      `);

    res.json({ success: true, reservaciones: result.recordset });
  } catch (error) {
    console.error('Error al obtener reservaciones:', error);
    res.status(500).json({ success: false, message: 'Error al obtener reservaciones' });
  }
}

async function obtenerDisponibilidad(req, res) {
  const { fecha } = req.params;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('fecha', sql.Date, fecha)
      .query(`
        SELECT
          LEFT(CONVERT(VARCHAR, HoraReservacion, 108), 5) AS Hora,
          COUNT(*) AS Cantidad
        FROM Reservaciones
        WHERE FechaReservacion = @fecha AND Estado != 'Cancelada'
        GROUP BY HoraReservacion
      `);

    const disponibilidad = {};
    for (const row of result.recordset) {
      disponibilidad[row.Hora] = row.Cantidad;
    }

    res.json({ success: true, disponibilidad });
  } catch (error) {
    console.error('Error al obtener disponibilidad:', error);
    res.status(500).json({ success: false, message: 'Error al obtener disponibilidad' });
  }
}

async function crearReservacion(req, res) {
  const { idUsuario, fecha, hora, cantidadPersonas, comentarios } = req.body;

  if (!idUsuario || !fecha || !hora || !cantidadPersonas) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
  }

  try {
    const pool = await getConnection();

    const capacidadResult = await pool.request()
      .input('fecha', sql.Date, fecha)
      .input('hora', sql.VarChar(10), hora + ':00')
      .query(`
        SELECT COUNT(*) AS Total
        FROM Reservaciones
        WHERE FechaReservacion = @fecha AND HoraReservacion = @hora AND Estado != 'Cancelada'
      `);

    if (capacidadResult.recordset[0].Total >= 10) {
      return res.status(400).json({ success: false, message: 'Este horario ya está completo. Por favor elige otro.' });
    }

    const result = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('fecha', sql.Date, fecha)
      .input('hora', sql.VarChar(10), hora + ':00')
      .input('cantidadPersonas', sql.Int, cantidadPersonas)
      .input('comentarios', sql.VarChar(300), comentarios || null)
      .query(`
        INSERT INTO Reservaciones (IdUsuario, FechaReservacion, HoraReservacion, CantidadPersonas, Comentarios)
        OUTPUT INSERTED.IdReservacion
        VALUES (@idUsuario, @fecha, @hora, @cantidadPersonas, @comentarios)
      `);

    res.json({ success: true, idReservacion: result.recordset[0].IdReservacion });
  } catch (error) {
    console.error('Error al crear reservacion:', error);
    res.status(500).json({ success: false, message: 'Error al crear la reservacion' });
  }
}

async function cancelarReservacion(req, res) {
  const { idReservacion } = req.params;
  try {
    const pool = await getConnection();
    await pool.request()
      .input('idReservacion', sql.Int, idReservacion)
      .query(`UPDATE Reservaciones SET Estado = 'Cancelada' WHERE IdReservacion = @idReservacion`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error al cancelar reservacion:', error);
    res.status(500).json({ success: false, message: 'Error al cancelar la reservacion' });
  }
}

module.exports = { obtenerReservaciones, obtenerDisponibilidad, crearReservacion, cancelarReservacion };
