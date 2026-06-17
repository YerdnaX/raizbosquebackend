const express = require('express');
const router = express.Router();
const { actualizarPerfil, cambiarContrasena } = require('../controllers/usuarios.controller');

router.put('/:id', actualizarPerfil);
router.put('/:id/cambiar-contrasena', cambiarContrasena);

module.exports = router;
