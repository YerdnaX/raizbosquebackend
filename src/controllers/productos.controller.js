const { getConnection, sql } = require('../config/db');

const PROVEDOR_VIVERO_API_URL = process.env.PROVEDOR_VIVERO_API_URL || 'http://localhost:8001';
const PROVEDOR_PRODUCTOS_API_URL = process.env.PROVEDOR_PRODUCTOS_API_URL || 'http://localhost:8002';
const PROVEDOR_TIMEOUT_MS = 5000;

async function consultarProvedor(nombreProvedor, apiUrl, idProductoProvedor) {
  if (!idProductoProvedor) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVEDOR_TIMEOUT_MS);

  try {
    const respuesta = await fetch(
      `${apiUrl}/api/disponibilidad/${idProductoProvedor}`,
      { signal: controller.signal }
    );

    if (respuesta.status === 404) {
      return null;
    }

    if (!respuesta.ok) {
      console.error(`Error consultando ${nombreProvedor}:`, respuesta.status);
      return null;
    }

    const productoProvedor = await respuesta.json();

    return {
      cantidadDisponible: productoProvedor.cantidadDisponible,
      tiempoReposicionDias: productoProvedor.tiempoReposicionDias,
      estado: productoProvedor.estado
    };
  } catch (error) {
    console.error(`No se pudo consultar ${nombreProvedor}:`, error.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function obtenerConfigProvedor(producto) {
  if (producto.TipoProducto === 'Planta') {
    return {
      nombre: 'provedor vivero',
      apiUrl: PROVEDOR_VIVERO_API_URL,
      idProductoProvedor: producto.IdProductoProvedorVivero
    };
  }

  if (producto.TipoProducto === 'ProductoVivero') {
    return {
      nombre: 'provedor productos',
      apiUrl: PROVEDOR_PRODUCTOS_API_URL,
      idProductoProvedor: producto.IdProductoProvedorProductos
    };
  }

  return null;
}

async function consultarProvedorProducto(producto) {
  const config = obtenerConfigProvedor(producto);

  if (!config) {
    return null;
  }

  return consultarProvedor(config.nombre, config.apiUrl, config.idProductoProvedor);
}

async function agregarProvedorAProductos(productos) {
  return Promise.all(
    productos.map(async (producto) => ({
      ...producto,
      Provedor: await consultarProvedorProducto(producto)
    }))
  );
}

async function getProductosVivero(req, res) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT
        p.IdProducto, p.IdProductoProvedorVivero, p.IdProductoProvedorProductos,
        p.Nombre, p.Descripcion, p.Precio, p.Imagen, p.Stock, p.TipoProducto,
        c.NombreCategoria,
        pl.FrecuenciaRiego, pl.NivelLuz, pl.TamanoAproximado, pl.NivelDificultad,
        pl.TipoClima, pl.CuidadosEspeciales, pl.TemperaturaRecomendada, pl.TipoSuelo
      FROM Productos p
      INNER JOIN Categorias c ON p.IdCategoria = c.IdCategoria
      LEFT JOIN Plantas pl ON p.IdProducto = pl.IdProducto
      WHERE c.Tipo = 'Vivero' AND p.Disponible >= 1
      ORDER BY p.IdProducto
    `);
    const productos = await agregarProvedorAProductos(result.recordset);
    res.json({ success: true, productos });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos del vivero' });
  }
}

async function getProductosRestaurante(req, res) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT
        p.IdProducto, p.Nombre, p.Descripcion, p.Precio, p.Imagen, p.Stock,
        c.NombreCategoria
      FROM Productos p
      INNER JOIN Categorias c ON p.IdCategoria = c.IdCategoria
      WHERE c.Tipo = 'Restaurante' AND p.Disponible >= 1
      ORDER BY p.IdProducto
    `);
    res.json({ success: true, productos: result.recordset });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos del restaurante' });
  }
}

async function getPlantaDelMes(req, res) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT TOP 1
        p.IdProducto, p.Nombre, p.Descripcion, p.Precio, p.Imagen,
        c.NombreCategoria,
        pl.FrecuenciaRiego, pl.NivelLuz, pl.TamanoAproximado, pl.NivelDificultad
      FROM Productos p
      INNER JOIN Categorias c ON p.IdCategoria = c.IdCategoria
      INNER JOIN Plantas pl ON p.IdProducto = pl.IdProducto
      WHERE c.Tipo = 'Vivero' AND p.Disponible >= 1
      ORDER BY p.FechaRegistro DESC
    `);
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No hay planta del mes disponible' });
    }
    res.json({ success: true, planta: result.recordset[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la planta del mes' });
  }
}

async function getProductosViveroProductos(req, res) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT
        p.IdProducto, p.IdProductoProvedorVivero, p.IdProductoProvedorProductos,
        p.Nombre, p.Descripcion, p.Precio, p.Imagen, p.Stock, p.TipoProducto,
        c.NombreCategoria
      FROM Productos p
      INNER JOIN Categorias c ON p.IdCategoria = c.IdCategoria
      WHERE p.TipoProducto = 'ProductoVivero' AND p.Disponible >= 1
      ORDER BY c.NombreCategoria, p.Nombre
    `);
    const productos = await agregarProvedorAProductos(result.recordset);
    res.json({ success: true, productos });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los productos del vivero' });
  }
}

async function getPlatoDelDia(req, res) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT TOP 1
        p.IdProducto, p.Nombre, p.Descripcion, p.Precio, p.Imagen, p.Stock,
        c.NombreCategoria
      FROM Productos p
      INNER JOIN Categorias c ON p.IdCategoria = c.IdCategoria
      WHERE c.Tipo = 'Restaurante' AND p.Disponible >= 1
      ORDER BY p.FechaRegistro DESC
    `);
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No hay plato del día disponible' });
    }
    res.json({ success: true, plato: result.recordset[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el plato del día' });
  }
}

async function getProductoPorId(req, res) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT
          p.IdProducto, p.IdProductoProvedorVivero, p.IdProductoProvedorProductos,
          p.Nombre, p.Descripcion, p.Precio, p.Imagen, p.Stock, p.TipoProducto,
          c.NombreCategoria, c.Tipo AS TipoCategoria,
          pl.FrecuenciaRiego, pl.NivelLuz, pl.TamanoAproximado, pl.NivelDificultad,
          pl.TipoClima, pl.CuidadosEspeciales, pl.TemperaturaRecomendada, pl.TipoSuelo
        FROM Productos p
        INNER JOIN Categorias c ON p.IdCategoria = c.IdCategoria
        LEFT JOIN Plantas pl ON p.IdProducto = pl.IdProducto
        WHERE p.IdProducto = @id AND p.Disponible >= 1
      `);
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const producto = result.recordset[0];
    if (producto.TipoCategoria === 'Vivero') {
      producto.Provedor = await consultarProvedorProducto(producto);
    }
    delete producto.TipoCategoria;
    res.json({ success: true, producto });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
}

module.exports = { getProductosVivero, getProductosRestaurante, getPlantaDelMes, getPlatoDelDia, getProductoPorId, getProductosViveroProductos };
