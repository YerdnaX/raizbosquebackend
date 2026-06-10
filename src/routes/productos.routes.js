const express = require('express');
const router = express.Router();
const { getProductosVivero, getProductosRestaurante, getPlantaDelMes, getProductoPorId } = require('../controllers/productos.controller');

router.get('/vivero', getProductosVivero);
router.get('/restaurante', getProductosRestaurante);
router.get('/planta-del-mes', getPlantaDelMes);
router.get('/:id', getProductoPorId);

module.exports = router;
