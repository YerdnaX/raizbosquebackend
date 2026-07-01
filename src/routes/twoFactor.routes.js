const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/twoFactor.controller');

// Estado del 2FA del usuario
router.get('/2fa/status', ctrl.getStatus);

// Configuración y verificación (app principal)
router.post('/2fa/setup',        ctrl.setup);
router.post('/2fa/verify-setup', ctrl.verifySetup);
router.post('/2fa/verify-login', ctrl.verifyLogin);
router.post('/2fa/disable',      ctrl.disable);

// Endpoints exclusivos para raizbosqueotp
router.post('/otp-app/login',        ctrl.otpAppLogin);
router.post('/otp-app/link',         ctrl.otpAppLink);
router.post('/otp-app/confirm-link', ctrl.otpAppConfirmLink);
router.post('/otp-app/unlink',       ctrl.otpAppUnlink);
router.post('/otp-app/logout',       ctrl.otpAppLogout);

module.exports = router;
