const express = require('express');
const router = express.Router();
const {
  obtenerReservaciones,
  obtenerDisponibilidad,
  crearReservacion,
  cancelarReservacion,
} = require('../controllers/reservaciones.controller');

router.get('/disponibilidad/:fecha', obtenerDisponibilidad);
router.get('/:idUsuario', obtenerReservaciones);
router.post('/', crearReservacion);
router.put('/:idReservacion/cancelar', cancelarReservacion);

module.exports = router;
