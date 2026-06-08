const express = require('express');
const router = express.Router();
const { checkDb } = require('../controllers/health.controller');

router.get('/db', checkDb);

module.exports = router;
