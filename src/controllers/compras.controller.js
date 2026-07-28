const { getConnection, sql } = require('../config/db');
const { validarCadenaUbicacion, construirDireccionEntrega } = require('../services/ubicacionesService');

const PROVEDOR_ENTREGAS_API_URL = process.env.PROVEDOR_ENTREGAS_API_URL || 'http://localhost:8003';
const PROVEDOR_ENTREGAS_TIMEOUT_MS = 5000;
const PROVEDOR_CUPONES_API_URL = process.env.PROVEDOR_CUPONES_API_URL || 'http://localhost:8004';
const PROVEDOR_CUPONES_TIMEOUT_MS = 5000;
const PROVEDOR_BANCO_API_URL = process.env.PROVEDOR_BANCO_API_URL || 'http://localhost:8005';
const PROVEDOR_BANCO_TIMEOUT_MS = 5000;

async function resolverDireccionEntrega({ direccionEntrega, ubicacion }) {
  if (ubicacion) {
    const { idsSeleccionados, direccionExacta } = ubicacion;

    if (!Array.isArray(idsSeleccionados) || idsSeleccionados.length === 0) {
      return { error: 'Debe completar la ubicacion de entrega' };
    }
    if (!direccionExacta || !direccionExacta.trim()) {
      return { error: 'Debe indicar la direccion exacta' };
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

  return { error: 'Debe indicar una direccion de entrega' };
}

async function registrarEntregaConProvedor({ numeroOrden, direccionEntrega }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVEDOR_ENTREGAS_TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${PROVEDOR_ENTREGAS_API_URL}/api/entregas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        numeroOrden,
        direccionEntrega,
      }),
      signal: controller.signal,
    });

    if (!respuesta.ok) {
      console.error('Error registrando entrega con provedor:', respuesta.status);
      return null;
    }

    const entrega = await respuesta.json();
    return entrega.trackingNumber || null;
  } catch (error) {
    console.error('No se pudo registrar entrega con provedor:', error.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function obtenerCarritoActivo(pool, idUsuario) {
  const carritoResult = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`SELECT TOP 1 IdCarrito FROM Carritos WHERE IdUsuario = @idUsuario AND Estado = 'Activo' ORDER BY IdCarrito ASC`);

  if (carritoResult.recordset.length === 0) {
    return { error: 'No hay carrito activo' };
  }

  const idCarrito = carritoResult.recordset[0].IdCarrito;

  const itemsResult = await pool.request()
    .input('idCarrito', sql.Int, idCarrito)
    .query(`SELECT IdProducto, Cantidad, PrecioUnitario, Subtotal FROM CarritoDetalle WHERE IdCarrito = @idCarrito`);

  if (itemsResult.recordset.length === 0) {
    return { error: 'El carrito esta vacio' };
  }

  return {
    idCarrito,
    items: itemsResult.recordset,
  };
}

async function validarCuponConProvedor(codigoCupon) {
  const codigo = codigoCupon ? codigoCupon.trim().toUpperCase() : '';

  if (!codigo) {
    return { cupon: null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVEDOR_CUPONES_TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${PROVEDOR_CUPONES_API_URL}/api/cupones/validar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ codigo }),
      signal: controller.signal,
    });

    if (!respuesta.ok) {
      return { error: 'No se pudo validar el cupon' };
    }

    const resultado = await respuesta.json();

    if (!resultado.valido) {
      return { error: resultado.message || 'Cupon no valido' };
    }

    return {
      cupon: {
        codigo: resultado.codigo,
        descripcion: resultado.descripcion,
        tipoDescuento: resultado.tipoDescuento,
        valorDescuento: Number(resultado.valorDescuento),
      },
    };
  } catch (error) {
    console.error('No se pudo validar cupon con provedor:', error.message);
    return { error: 'No se pudo validar el cupon' };
  } finally {
    clearTimeout(timeout);
  }
}

function validarMetodoPago(metodoPago) {
  if (!metodoPago || typeof metodoPago !== 'object') {
    return { error: 'Debe indicar el metodo de pago' };
  }

  const tieneTarjeta = !!metodoPago.tarjeta;
  const tieneSinpe = !!metodoPago.sinpe;

  if (tieneTarjeta === tieneSinpe) {
    return { error: 'Debe indicar un solo metodo de pago' };
  }

  if (tieneTarjeta) {
    const datosTarjeta = metodoPago.tarjeta.tarjeta;
    const propietario = metodoPago.tarjeta.propietario;

    if (
      !datosTarjeta?.identificador ||
      !datosTarjeta?.cvv ||
      !datosTarjeta?.fechaVencimiento ||
      !propietario?.nombre
    ) {
      return { error: 'Faltan datos de la tarjeta' };
    }

    return {
      tipo: 'tarjeta',
      endpoint: '/tarjeta/pago',
      body: metodoPago.tarjeta,
    };
  }

  if (!metodoPago.sinpe.telefono) {
    return { error: 'Faltan datos de SINPE' };
  }

  return {
    tipo: 'sinpe',
    endpoint: '/sinpe/pago',
    body: metodoPago.sinpe,
  };
}

async function pagarConProvedorBanco(metodoPago, monto) {
  const validacion = validarMetodoPago(metodoPago);
  if (validacion.error) {
    return { error: validacion.error };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVEDOR_BANCO_TIMEOUT_MS);

  try {
    const respuesta = await fetch(`${PROVEDOR_BANCO_API_URL}${validacion.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        monto,
        ...validacion.body,
      }),
      signal: controller.signal,
    });

    const resultado = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !resultado.success) {
      return { error: resultado.message || 'No se pudo procesar el pago' };
    }

    return {
      pago: {
        tipo: validacion.tipo,
        idPago: resultado.idPago,
      },
    };
  } catch (error) {
    console.error('No se pudo procesar pago con provedor banco:', error.message);
    return { error: 'No se pudo validar el pago' };
  } finally {
    clearTimeout(timeout);
  }
}

function redondearMonto(monto) {
  return Math.round(monto * 100) / 100;
}

function calcularMontoDescuento(cupon, subtotal) {
  if (!cupon) return 0;

  if (cupon.tipoDescuento === 'PORCENTAJE') {
    return Math.min(redondearMonto(subtotal * (cupon.valorDescuento / 100)), subtotal);
  }

  if (cupon.tipoDescuento === 'MONTO_FIJO') {
    return Math.min(redondearMonto(cupon.valorDescuento), subtotal);
  }

  return 0;
}

async function construirResumenCompra(pool, idUsuario, codigoCupon) {
  const carrito = await obtenerCarritoActivo(pool, idUsuario);
  if (carrito.error) {
    return { error: carrito.error };
  }

  const subtotal = redondearMonto(carrito.items.reduce((suma, row) => suma + parseFloat(row.Subtotal), 0));
  const resultadoCupon = await validarCuponConProvedor(codigoCupon);

  if (resultadoCupon.error) {
    return { error: resultadoCupon.error };
  }

  const descuento = calcularMontoDescuento(resultadoCupon.cupon, subtotal);
  const subtotalConDescuento = redondearMonto(subtotal - descuento);
  const impuesto = redondearMonto(subtotalConDescuento * 0.13);
  const total = redondearMonto(subtotalConDescuento + impuesto);

  return {
    idCarrito: carrito.idCarrito,
    items: carrito.items,
    subtotal,
    descuento,
    impuesto,
    total,
    cupon: resultadoCupon.cupon
      ? {
          ...resultadoCupon.cupon,
          montoDescuento: descuento,
        }
      : null,
  };
}

async function comprasTieneCamposCupon(pool) {
  const result = await pool.request().query(`
    SELECT
      COL_LENGTH('Compras', 'CodigoCupon') AS CodigoCupon,
      COL_LENGTH('Compras', 'Descuento') AS Descuento
  `);

  const row = result.recordset[0];
  return !!(row.CodigoCupon && row.Descuento);
}

async function obtenerResumenCompra(req, res) {
  const { idUsuario, codigoCupon } = req.body;

  if (!idUsuario) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
  }

  try {
    const pool = await getConnection();
    const resumen = await construirResumenCompra(pool, idUsuario, codigoCupon);

    if (resumen.error) {
      return res.status(400).json({ success: false, message: resumen.error });
    }

    res.json({
      success: true,
      subtotal: resumen.subtotal,
      descuento: resumen.descuento,
      impuesto: resumen.impuesto,
      total: resumen.total,
      cupon: resumen.cupon,
    });
  } catch (error) {
    console.error('Error al obtener resumen de compra:', error);
    res.status(500).json({ success: false, message: 'Error al obtener resumen de compra' });
  }
}

async function realizarCompra(req, res) {
  const { idUsuario, metodoEntrega, direccionEntrega, ubicacion, codigoCupon, metodoPago } = req.body;

  if (!idUsuario || !metodoEntrega) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
  }

  const validacionPago = validarMetodoPago(metodoPago);
  if (validacionPago.error) {
    return res.status(400).json({ success: false, message: validacionPago.error });
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
    const resumen = await construirResumenCompra(pool, idUsuario, codigoCupon);

    if (resumen.error) {
      return res.status(400).json({ success: false, message: resumen.error });
    }

    const resultadoPago = await pagarConProvedorBanco(metodoPago, resumen.total);
    if (resultadoPago.error) {
      return res.status(400).json({ success: false, message: resultadoPago.error });
    }

    const tieneCamposCupon = await comprasTieneCamposCupon(pool);
    const compraRequest = pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('subtotal', sql.Decimal(10, 2), resumen.subtotal)
      .input('impuesto', sql.Decimal(10, 2), resumen.impuesto)
      .input('total', sql.Decimal(10, 2), resumen.total)
      .input('metodoEntrega', sql.VarChar(50), metodoEntrega)
      .input('direccionEntrega', sql.VarChar(300), direccionFinal);

    let compraResult;
    if (tieneCamposCupon) {
      compraResult = await compraRequest
        .input('codigoCupon', sql.VarChar(50), resumen.cupon ? resumen.cupon.codigo : null)
        .input('descuento', sql.Decimal(10, 2), resumen.descuento)
        .query(`
          INSERT INTO Compras (IdUsuario, Subtotal, Impuesto, Total, MetodoEntrega, DireccionEntrega, CodigoCupon, Descuento)
          OUTPUT INSERTED.IdCompra
          VALUES (@idUsuario, @subtotal, @impuesto, @total, @metodoEntrega, @direccionEntrega, @codigoCupon, @descuento)
        `);
    } else {
      compraResult = await compraRequest.query(`
        INSERT INTO Compras (IdUsuario, Subtotal, Impuesto, Total, MetodoEntrega, DireccionEntrega)
        OUTPUT INSERTED.IdCompra
        VALUES (@idUsuario, @subtotal, @impuesto, @total, @metodoEntrega, @direccionEntrega)
      `);
    }

    const idCompra = compraResult.recordset[0].IdCompra;

    for (const item of resumen.items) {
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
      .input('idCarrito', sql.Int, resumen.idCarrito)
      .query(`UPDATE Carritos SET Estado = 'Completado' WHERE IdCarrito = @idCarrito`);

    let trackingNumber = null;
    if (metodoEntrega === 'Domicilio') {
      trackingNumber = await registrarEntregaConProvedor({
        numeroOrden: idCompra,
        direccionEntrega: direccionFinal,
      });
    }

    res.json({
      success: true,
      idCompra,
      numeroOrden: idCompra,
      trackingNumber,
      direccionEntrega: direccionFinal,
      subtotal: resumen.subtotal,
      descuento: resumen.descuento,
      impuesto: resumen.impuesto,
      total: resumen.total,
      cupon: resumen.cupon,
    });
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

module.exports = { realizarCompra, obtenerHistorial, obtenerResumenCompra };
