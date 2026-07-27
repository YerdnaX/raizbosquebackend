const express = require('express');
const router = express.Router();
const { realizarCompra, obtenerHistorial, obtenerResumenCompra } = require('../controllers/compras.controller');

router.get('/:idUsuario', obtenerHistorial);
router.post('/resumen', obtenerResumenCompra);
router.post('/', realizarCompra);

module.exports = router;
