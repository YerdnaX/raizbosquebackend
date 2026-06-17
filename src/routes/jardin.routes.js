const express = require('express');
const router = express.Router();
const { obtenerJardin, agregarPlanta, eliminarPlanta } = require('../controllers/jardin.controller');

router.get('/:idUsuario', obtenerJardin);
router.post('/:idUsuario/agregar', agregarPlanta);
router.delete('/:idJardin', eliminarPlanta);

module.exports = router;
