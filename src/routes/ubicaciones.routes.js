const express = require('express');
const router = express.Router();
const {
  obtenerPaises,
  obtenerHijos,
  obtenerConfiguracion,
} = require('../controllers/ubicaciones.controller');

router.get('/paises', obtenerPaises);
router.get('/paises/:idPais/configuracion', obtenerConfiguracion);
router.get('/:idUbicacion/hijos', obtenerHijos);

module.exports = router;
