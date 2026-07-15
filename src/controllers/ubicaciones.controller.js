const ubicacionesService = require('../services/ubicacionesService');

async function obtenerPaises(req, res) {
  try {
    const paises = await ubicacionesService.obtenerPaises();
    res.json(paises);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los países' });
  }
}

async function obtenerHijos(req, res) {
  const idUbicacion = Number(req.params.idUbicacion);

  if (!Number.isInteger(idUbicacion)) {
    return res.status(400).json({ error: 'El id de ubicación no es válido' });
  }

  try {
    const padre = await ubicacionesService.obtenerUbicacionPorId(idUbicacion);
    if (!padre) {
      return res.status(404).json({ error: 'La ubicación indicada no existe' });
    }

    const hijos = await ubicacionesService.obtenerHijos(idUbicacion);
    res.json(hijos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las ubicaciones hijas' });
  }
}

async function obtenerConfiguracion(req, res) {
  const idPais = Number(req.params.idPais);

  if (!Number.isInteger(idPais)) {
    return res.status(400).json({ error: 'El id de país no es válido' });
  }

  try {
    const configuracion = await ubicacionesService.obtenerConfiguracionPais(idPais);
    if (!configuracion) {
      return res.status(404).json({ error: 'No existe configuración para el país indicado' });
    }

    res.json(configuracion);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la configuración del país' });
  }
}

module.exports = { obtenerPaises, obtenerHijos, obtenerConfiguracion };
