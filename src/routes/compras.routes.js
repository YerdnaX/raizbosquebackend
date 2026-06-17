const express = require('express');
const router = express.Router();
const { realizarCompra, obtenerHistorial } = require('../controllers/compras.controller');

router.get('/:idUsuario', obtenerHistorial);
router.post('/', realizarCompra);

module.exports = router;
