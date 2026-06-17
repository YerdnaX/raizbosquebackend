const express = require('express');
const router = express.Router();
const { realizarCompra } = require('../controllers/compras.controller');

router.post('/', realizarCompra);

module.exports = router;
