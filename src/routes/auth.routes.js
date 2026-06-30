const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/auth.controller');

// Login
router.post('/login', ctrl.login);

// Registro multi-paso
router.post('/registro/enviar-codigo',    ctrl.enviarCodigoRegistro);
router.post('/registro/verificar-codigo', ctrl.verificarCodigoRegistro);
router.get( '/registro/verificar-usuario',ctrl.verificarNombreUsuario);
router.post('/registro/completar',        ctrl.completarRegistro);

// Preguntas de seguridad (catálogo)
router.get('/preguntas-seguridad', ctrl.getPreguntasSeguridad);

// Recuperación de contraseña
router.post('/recuperar-contrasena/enviar-codigo',       ctrl.enviarCodigoRecuperacion);
router.post('/recuperar-contrasena/verificar-codigo',    ctrl.verificarCodigoRecuperacion);
router.post('/recuperar-contrasena/preguntas',           ctrl.obtenerPreguntasRecuperacion);
router.post('/recuperar-contrasena/verificar-respuestas',ctrl.verificarRespuestasSeguridad);
router.post('/recuperar-contrasena/nueva-contrasena',    ctrl.establecerNuevaContrasena);
router.post('/recuperar-contrasena/vencida',             ctrl.cambiarContrasenaVencida);

// Recuperación de nombre de usuario
router.post('/recuperar-usuario/pregunta',           ctrl.obtenerPreguntaRecuperacionUsuario);
router.post('/recuperar-usuario/verificar-respuesta',ctrl.verificarRespuestaRecuperacionUsuario);

// Ruta de registro simple (compatibilidad con clientes legacy — ahora redirige al flujo multi-paso)
// Puede quitarse cuando todos los clientes usen el nuevo flujo.
router.post('/registro', (req, res) => {
  res.status(410).json({
    codigo: 'DEPRECATED',
    error: 'Esta ruta fue reemplazada. Usa el flujo de registro multi-paso: /registro/enviar-codigo',
  });
});

module.exports = router;
