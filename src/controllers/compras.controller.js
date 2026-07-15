const { getConnection, sql } = require('../config/db');
const { validarCadenaUbicacion, construirDireccionEntrega } = require('../services/ubicacionesService');

// Determina la dirección final a guardar (string). Si el cliente envía una
// ubicación armada con los dropdowns en cascada, los nombres se toman de la
// base de datos (nunca del texto libre del cliente) y se valida la jerarquía
// completa. Si en cambio envía una dirección guardada (flujo existente), se
// usa tal cual para mantener compatibilidad con direcciones ya guardadas.
async function resolverDireccionEntrega({ direccionEntrega, ubicacion }) {
  if (ubicacion) {
    const { idsSeleccionados, direccionExacta } = ubicacion;

    if (!Array.isArray(idsSeleccionados) || idsSeleccionados.length === 0) {
      return { error: 'Debe completar la ubicación de entrega' };
    }
    if (!direccionExacta || !direccionExacta.trim()) {
      return { error: 'Debe indicar la dirección exacta' };
    }

    const validacion = await validarCadenaUbicacion(idsSeleccionados);
    if (!validacion.valido) {
      return { error: validacion.motivo };
    }

    return { direccion: construirDireccionEntrega(validacion.nombres, direccionExacta.trim()) };
  }

  if (direccionEntrega && direccionEntrega.trim()) {
    return { direccion: direccionEntrega.trim() };
  }

  return { error: 'Debe indicar una dirección de entrega' };
}

async function realizarCompra(req, res) {
  const { idUsuario, metodoEntrega, direccionEntrega, ubicacion } = req.body;

  if (!idUsuario || !metodoEntrega) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
  }

  let direccionFinal = null;
  if (metodoEntrega === 'Domicilio') {
    const resultado = await resolverDireccionEntrega({ direccionEntrega, ubicacion });
    if (resultado.error) {
      return res.status(400).json({ success: false, message: resultado.error });
    }
    direccionFinal = resultado.direccion;
  }

  try {
    const pool = await getConnection();

    const carritoResult = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .query(`SELECT TOP 1 IdCarrito FROM Carritos WHERE IdUsuario = @idUsuario AND Estado = 'Activo' ORDER BY IdCarrito ASC`);

    if (carritoResult.recordset.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay carrito activo' });
    }

    const idCarrito = carritoResult.recordset[0].IdCarrito;

    const itemsResult = await pool.request()
      .input('idCarrito', sql.Int, idCarrito)
      .query(`SELECT IdProducto, Cantidad, PrecioUnitario, Subtotal FROM CarritoDetalle WHERE IdCarrito = @idCarrito`);

    if (itemsResult.recordset.length === 0) {
      return res.status(400).json({ success: false, message: 'El carrito está vacío' });
    }

    const subtotal = itemsResult.recordset.reduce((suma, row) => suma + parseFloat(row.Subtotal), 0);
    const impuesto = Math.round(subtotal * 0.13 * 100) / 100;
    const total = Math.round((subtotal + impuesto) * 100) / 100;

    const compraResult = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('subtotal', sql.Decimal(10, 2), subtotal)
      .input('impuesto', sql.Decimal(10, 2), impuesto)
      .input('total', sql.Decimal(10, 2), total)
      .input('metodoEntrega', sql.VarChar(50), metodoEntrega)
      .input('direccionEntrega', sql.VarChar(300), direccionFinal)
      .query(`
        INSERT INTO Compras (IdUsuario, Subtotal, Impuesto, Total, MetodoEntrega, DireccionEntrega)
        OUTPUT INSERTED.IdCompra
        VALUES (@idUsuario, @subtotal, @impuesto, @total, @metodoEntrega, @direccionEntrega)
      `);

    const idCompra = compraResult.recordset[0].IdCompra;

    for (const item of itemsResult.recordset) {
      await pool.request()
        .input('idCompra', sql.Int, idCompra)
        .input('idProducto', sql.Int, item.IdProducto)
        .input('cantidad', sql.Int, item.Cantidad)
        .input('precioUnitario', sql.Decimal(10, 2), parseFloat(item.PrecioUnitario))
        .input('subtotalItem', sql.Decimal(10, 2), parseFloat(item.Subtotal))
        .query(`
          INSERT INTO CompraDetalle (IdCompra, IdProducto, Cantidad, PrecioUnitario, Subtotal)
          VALUES (@idCompra, @idProducto, @cantidad, @precioUnitario, @subtotalItem)
        `);
    }

    await pool.request()
      .input('idCarrito', sql.Int, idCarrito)
      .query(`UPDATE Carritos SET Estado = 'Completado' WHERE IdCarrito = @idCarrito`);

    res.json({ success: true, idCompra });
  } catch (error) {
    console.error('Error al realizar compra:', error);
    res.status(500).json({ success: false, message: 'Error al procesar la compra' });
  }
}

async function obtenerHistorial(req, res) {
  const { idUsuario } = req.params;
  try {
    const pool = await getConnection();

    const result = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .query(`
        SELECT
          c.IdCompra, c.FechaCompra,
          c.Subtotal AS CompraSubtotal, c.Impuesto, c.Total,
          c.MetodoEntrega, c.DireccionEntrega, c.EstadoCompra,
          cd.IdProducto, p.Nombre AS NombreProducto, p.Imagen,
          cd.Cantidad, cd.PrecioUnitario, cd.Subtotal AS ItemSubtotal
        FROM Compras c
        INNER JOIN CompraDetalle cd ON c.IdCompra = cd.IdCompra
        INNER JOIN Productos p ON cd.IdProducto = p.IdProducto
        WHERE c.IdUsuario = @idUsuario
        ORDER BY c.FechaCompra DESC, c.IdCompra DESC
      `);

    const comprasMap = new Map();
    for (const row of result.recordset) {
      if (!comprasMap.has(row.IdCompra)) {
        comprasMap.set(row.IdCompra, {
          IdCompra: row.IdCompra,
          FechaCompra: row.FechaCompra,
          Subtotal: parseFloat(row.CompraSubtotal),
          Impuesto: parseFloat(row.Impuesto),
          Total: parseFloat(row.Total),
          MetodoEntrega: row.MetodoEntrega,
          DireccionEntrega: row.DireccionEntrega,
          EstadoCompra: row.EstadoCompra,
          items: [],
        });
      }
      comprasMap.get(row.IdCompra).items.push({
        IdProducto: row.IdProducto,
        Nombre: row.NombreProducto,
        Imagen: row.Imagen,
        Cantidad: row.Cantidad,
        PrecioUnitario: parseFloat(row.PrecioUnitario),
        Subtotal: parseFloat(row.ItemSubtotal),
      });
    }

    res.json({ success: true, compras: Array.from(comprasMap.values()) });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ success: false, message: 'Error al obtener el historial' });
  }
}

module.exports = { realizarCompra, obtenerHistorial };
