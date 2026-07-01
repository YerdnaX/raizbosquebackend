const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/twoFactor.controller');

// Estado del 2FA del usuario
router.get('/status', ctrl.getStatus);

// Configuración y verificación (app principal)
router.post('/setup',        ctrl.setup);
router.post('/verify-setup', ctrl.verifySetup);
router.post('/verify-login', ctrl.verifyLogin);
router.post('/disable',      ctrl.disable);

// Endpoints exclusivos para raizbosqueotp
router.post('/otp-app/login',        ctrl.otpAppLogin);
router.post('/otp-app/link',         ctrl.otpAppLink);
router.post('/otp-app/confirm-link', ctrl.otpAppConfirmLink);
router.post('/otp-app/unlink',       ctrl.otpAppUnlink);
router.post('/otp-app/logout',       ctrl.otpAppLogout);

module.exports = router;
