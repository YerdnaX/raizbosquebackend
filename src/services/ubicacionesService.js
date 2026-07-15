const { getConnection, sql } = require('../config/db');
const { CONFIGURACION_PAISES } = require('../config/ubicaciones.config');

async function obtenerPaises() {
  const pool = await getConnection();
  const resultado = await pool.request()
    .query('SELECT IdUbicacion, Nombre FROM UbicacionesGeograficas WHERE Nivel = 1 ORDER BY Nombre');
  return resultado.recordset;
}

async function obtenerUbicacionPorId(idUbicacion) {
  const pool = await getConnection();
  const resultado = await pool.request()
    .input('id', sql.Int, idUbicacion)
    .query('SELECT IdUbicacion, IdUbicacionPadre, Nivel, Nombre FROM UbicacionesGeograficas WHERE IdUbicacion = @id');
  return resultado.recordset[0] || null;
}

async function obtenerHijos(idUbicacionPadre) {
  const pool = await getConnection();
  const resultado = await pool.request()
    .input('idPadre', sql.Int, idUbicacionPadre)
    .query('SELECT IdUbicacion, Nombre, Nivel FROM UbicacionesGeograficas WHERE IdUbicacionPadre = @idPadre ORDER BY Nombre');
  return resultado.recordset;
}

async function tieneHijos(idUbicacion) {
  const pool = await getConnection();
  const resultado = await pool.request()
    .input('idPadre', sql.Int, idUbicacion)
    .query('SELECT TOP 1 IdUbicacion FROM UbicacionesGeograficas WHERE IdUbicacionPadre = @idPadre');
  return resultado.recordset.length > 0;
}

async function obtenerConfiguracionPais(idPais) {
  const pais = await obtenerUbicacionPorId(idPais);
  if (!pais || pais.Nivel !== 1) {
    return null;
  }

  const configuracion = CONFIGURACION_PAISES[pais.Nombre];
  if (!configuracion) {
    return null;
  }

  return {
    idPais: pais.IdUbicacion,
    nombrePais: pais.Nombre,
    niveles: configuracion.niveles,
  };
}

// Valida que idsSeleccionados sea una cadena País → ... → nivel más específico
// donde cada elemento pertenece realmente al anterior, y que el último elemento
// no tenga hijos (es decir, que el usuario haya llegado hasta el nivel más
// específico disponible para esa rama, sin asumir que todos los países tienen
// la misma cantidad de niveles).
async function validarCadenaUbicacion(idsSeleccionados) {
  if (!Array.isArray(idsSeleccionados) || idsSeleccionados.length === 0) {
    return { valido: false, motivo: 'Debe indicar al menos el país.' };
  }

  const cadena = [];
  let idPadreEsperado = null;

  for (let i = 0; i < idsSeleccionados.length; i++) {
    const nivelEsperado = i + 1;
    const registro = await obtenerUbicacionPorId(idsSeleccionados[i]);

    if (!registro) {
      return { valido: false, motivo: `La ubicación con id ${idsSeleccionados[i]} no existe.` };
    }

    if (registro.Nivel !== nivelEsperado) {
      return { valido: false, motivo: `"${registro.Nombre}" no corresponde al nivel esperado.` };
    }

    if (registro.IdUbicacionPadre !== idPadreEsperado) {
      return { valido: false, motivo: `"${registro.Nombre}" no pertenece al padre indicado.` };
    }

    cadena.push(registro);
    idPadreEsperado = registro.IdUbicacion;
  }

  const ultimaUbicacion = cadena[cadena.length - 1];
  if (await tieneHijos(ultimaUbicacion.IdUbicacion)) {
    return {
      valido: false,
      motivo: `Debe seleccionar hasta el nivel más específico disponible para "${ultimaUbicacion.Nombre}".`,
    };
  }

  return { valido: true, nombres: cadena.map((ubicacion) => ubicacion.Nombre) };
}

// Construye el string final de dirección: del nivel más específico al país,
// seguido de la dirección exacta u otras referencias de texto libre.
function construirDireccionEntrega(nombres, direccionExacta) {
  const partes = [...nombres].reverse();
  if (direccionExacta) {
    partes.push(direccionExacta);
  }

  return partes
    .map((parte) => (parte || '').trim())
    .filter((parte) => parte.length > 0)
    .join(', ');
}

module.exports = {
  obtenerPaises,
  obtenerUbicacionPorId,
  obtenerHijos,
  tieneHijos,
  obtenerConfiguracionPais,
  validarCadenaUbicacion,
  construirDireccionEntrega,
};
