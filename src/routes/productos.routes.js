const express = require('express');
const router = express.Router();
const { getProductosVivero, getProductosRestaurante, getPlantaDelMes, getProductoPorId, getProductosViveroProductos } = require('../controllers/productos.controller');

router.get('/vivero', getProductosVivero);
router.get('/vivero-productos', getProductosViveroProductos);
router.get('/restaurante', getProductosRestaurante);
router.get('/planta-del-mes', getPlantaDelMes);
router.get('/:id', getProductoPorId);

module.exports = router;
