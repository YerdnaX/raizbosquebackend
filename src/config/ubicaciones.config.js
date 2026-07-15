// Etiquetas y cantidad de niveles administrativos por país.
// Se indexa por el Nombre exacto del país tal como está guardado en
// UbicacionesGeograficas (Nivel = 1), para no duplicar datos geográficos aquí.
const CONFIGURACION_PAISES = {
  'Costa Rica': {
    niveles: [
      { nivel: 1, etiqueta: 'País' },
      { nivel: 2, etiqueta: 'Provincia' },
      { nivel: 3, etiqueta: 'Cantón' },
      { nivel: 4, etiqueta: 'Distrito' },
    ],
  },
  'Estados Unidos': {
    niveles: [
      { nivel: 1, etiqueta: 'País' },
      { nivel: 2, etiqueta: 'Estado' },
      { nivel: 3, etiqueta: 'Ciudad' },
    ],
  },
  'Panamá': {
    niveles: [
      { nivel: 1, etiqueta: 'País' },
      { nivel: 2, etiqueta: 'Provincia o Comarca' },
      { nivel: 3, etiqueta: 'Distrito' },
      { nivel: 4, etiqueta: 'Corregimiento' },
    ],
  },
};

module.exports = { CONFIGURACION_PAISES };
