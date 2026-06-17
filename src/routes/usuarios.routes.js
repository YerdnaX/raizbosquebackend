const express = require('express');
const router = express.Router();
const { actualizarPerfil } = require('../controllers/usuarios.controller');

router.put('/:id', actualizarPerfil);

module.exports = router;
