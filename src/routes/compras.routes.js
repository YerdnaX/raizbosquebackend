const express = require('express');
const router = express.Router();
const {
  realizarCompra,
  obtenerHistorial,
  obtenerResumenCompra,
  crearOrdenPaypal,
  capturarPaypal,
} = require('../controllers/compras.controller');

router.get('/:idUsuario', obtenerHistorial);
router.post('/resumen', obtenerResumenCompra);
router.post('/paypal/crear-orden', crearOrdenPaypal);
router.post('/paypal/capturar', capturarPaypal);
router.post('/', realizarCompra);

module.exports = router;
