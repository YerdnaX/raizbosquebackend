const express = require('express');
const cors = require('cors');
const path = require('path');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const productosRoutes = require('./routes/productos.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const carritoRoutes = require('./routes/carrito.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/imagenes', express.static(path.join(__dirname, '../public/imagenes')));

app.get('/', (req, res) => {
  res.json({ message: 'API raizbosquebackend funcionando correctamente' });
});

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/carrito', carritoRoutes);

module.exports = app;
