const { getConnection, sql } = require('../config/db');

async function obtenerCarrito(req, res) {
  const { idUsuario } = req.params;
  try {
    const pool = await getConnection();

    const carritoResult = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .query(`SELECT TOP 1 IdCarrito FROM Carritos WHERE IdUsuario = @idUsuario AND Estado = 'Activo' ORDER BY IdCarrito ASC`);

    if (carritoResult.recordset.length === 0) {
      return res.json({ success: true, idCarrito: null, items: [] });
    }

    const idCarrito = carritoResult.recordset[0].IdCarrito;

    const result = await pool.request()
      .input('idCarrito', sql.Int, idCarrito)
      .query(`
        SELECT cd.IdDetalle, cd.IdProducto, p.Nombre, p.Imagen, cd.Cantidad, cd.PrecioUnitario, cd.Subtotal
        FROM CarritoDetalle cd
        INNER JOIN Productos p ON cd.IdProducto = p.IdProducto
        WHERE cd.IdCarrito = @idCarrito
      `);

    const items = result.recordset.map(row => ({
      IdDetalle: row.IdDetalle,
      IdProducto: row.IdProducto,
      Nombre: row.Nombre,
      Imagen: row.Imagen,
      Cantidad: row.Cantidad,
      PrecioUnitario: parseFloat(row.PrecioUnitario),
      Subtotal: parseFloat(row.Subtotal),
    }));

    res.json({ success: true, idCarrito, items });
  } catch (error) {
    console.error('Error al obtener carrito:', error);
    res.status(500).json({ success: false, message: 'Error al obtener el carrito' });
  }
}

async function agregarItem(req, res) {
  const { idUsuario } = req.params;
  const { idProducto, precio } = req.body;

  try {
    const pool = await getConnection();

    const carritoResult = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .query(`SELECT TOP 1 IdCarrito FROM Carritos WHERE IdUsuario = @idUsuario AND Estado = 'Activo' ORDER BY IdCarrito ASC`);

    let idCarrito;
    if (carritoResult.recordset.length === 0) {
      const nuevoCarrito = await pool.request()
        .input('idUsuario', sql.Int, idUsuario)
        .query(`INSERT INTO Carritos (IdUsuario) OUTPUT INSERTED.IdCarrito VALUES (@idUsuario)`);
      idCarrito = nuevoCarrito.recordset[0].IdCarrito;
    } else {
      idCarrito = carritoResult.recordset[0].IdCarrito;
    }

    const detalleResult = await pool.request()
      .input('idCarrito', sql.Int, idCarrito)
      .input('idProducto', sql.Int, idProducto)
      .query(`SELECT IdDetalle FROM CarritoDetalle WHERE IdCarrito = @idCarrito AND IdProducto = @idProducto`);

    if (detalleResult.recordset.length > 0) {
      await pool.request()
        .input('idDetalle', sql.Int, detalleResult.recordset[0].IdDetalle)
        .query(`UPDATE CarritoDetalle SET Cantidad = Cantidad + 1 WHERE IdDetalle = @idDetalle`);
    } else {
      await pool.request()
        .input('idCarrito', sql.Int, idCarrito)
        .input('idProducto', sql.Int, idProducto)
        .input('precio', sql.Decimal(10, 2), precio)
        .query(`INSERT INTO CarritoDetalle (IdCarrito, IdProducto, Cantidad, PrecioUnitario) VALUES (@idCarrito, @idProducto, 1, @precio)`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al agregar item al carrito:', error);
    res.status(500).json({ success: false, message: 'Error al agregar al carrito' });
  }
}

async function actualizarCantidad(req, res) {
  const { idDetalle } = req.params;
  const { cantidad } = req.body;

  try {
    const pool = await getConnection();

    if (cantidad <= 0) {
      await pool.request()
        .input('idDetalle', sql.Int, idDetalle)
        .query(`DELETE FROM CarritoDetalle WHERE IdDetalle = @idDetalle`);
    } else {
      await pool.request()
        .input('idDetalle', sql.Int, idDetalle)
        .input('cantidad', sql.Int, cantidad)
        .query(`UPDATE CarritoDetalle SET Cantidad = @cantidad WHERE IdDetalle = @idDetalle`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar cantidad:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar cantidad' });
  }
}

async function eliminarItem(req, res) {
  const { idDetalle } = req.params;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('idDetalle', sql.Int, idDetalle)
      .query(`DELETE FROM CarritoDetalle WHERE IdDetalle = @idDetalle`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar item:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar item' });
  }
}

module.exports = { obtenerCarrito, agregarItem, actualizarCantidad, eliminarItem };
