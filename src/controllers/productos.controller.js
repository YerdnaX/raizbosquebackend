const { getConnection, sql } = require('../config/db');

async function getProductosVivero(req, res) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT
        p.IdProducto, p.Nombre, p.Descripcion, p.Precio, p.Imagen, p.Stock,
        c.NombreCategoria,
        pl.FrecuenciaRiego, pl.NivelLuz, pl.TamanoAproximado, pl.NivelDificultad,
        pl.TipoClima, pl.CuidadosEspeciales, pl.TemperaturaRecomendada, pl.TipoSuelo
      FROM Productos p
      INNER JOIN Categorias c ON p.IdCategoria = c.IdCategoria
      LEFT JOIN Plantas pl ON p.IdProducto = pl.IdProducto
      WHERE c.Tipo = 'Vivero' AND p.TipoProducto = 'Planta' AND p.Disponible = 1
      ORDER BY p.IdProducto
    `);
    res.json({ success: true, productos: result.recordset });
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
      WHERE c.Tipo = 'Restaurante' AND p.Disponible = 1
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
      WHERE c.Tipo = 'Vivero' AND p.TipoProducto = 'Planta' AND p.Disponible = 1
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

module.exports = { getProductosVivero, getProductosRestaurante, getPlantaDelMes };
