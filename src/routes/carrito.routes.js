const express = require('express');
const router = express.Router();
const { obtenerCarrito, agregarItem, actualizarCantidad, eliminarItem } = require('../controllers/carrito.controller');

router.get('/:idUsuario', obtenerCarrito);
router.post('/:idUsuario/agregar', agregarItem);
router.put('/detalle/:idDetalle', actualizarCantidad);
router.delete('/detalle/:idDetalle', eliminarItem);

module.exports = router;
