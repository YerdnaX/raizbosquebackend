USE tiusr15pl_RaicesCafeVivero;
GO

INSERT INTO Roles (NombreRol) VALUES
('Cliente'),
('Empleado'),
('Administrador');

INSERT INTO Usuarios 
(IdRol, Nombre, Apellidos, Correo, Telefono, Direccion, Contrasena)
VALUES
(1, 'Carlos', 'Ramírez Soto', 'carlos@email.com', '8888-1111', 'Cartago, Costa Rica', '123456'),
(1, 'María', 'Fernández Mora', 'maria@email.com', '8888-2222', 'San José, Costa Rica', '123456'),
(2, 'Andrea', 'Solano Vega', 'andrea@raices.com', '8888-3333', 'Cartago Centro', '123456'),
(3, 'Admin', 'Principal', 'admin@raices.com', '8888-9999', 'Raíces Café & Vivero', 'admin123');

INSERT INTO Categorias (NombreCategoria, Tipo) VALUES
('Café Caliente', 'Restaurante'),
('Bebidas Frías', 'Restaurante'),
('Comidas', 'Restaurante'),
('Postres', 'Restaurante'),
('Plantas de Interior', 'Vivero'),
('Plantas de Exterior', 'Vivero'),
('Macetas', 'Vivero'),
('Fertilizantes', 'Vivero'),
('Herramientas', 'Vivero');

INSERT INTO Productos 
(IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
VALUES
(1, 'Café Latte', 'Café espresso con leche vaporizada.', 2200, 'latte.jpg', 'Restaurante', 1, 50),
(1, 'Capuchino', 'Café espresso con espuma de leche.', 2300, 'capuchino.jpg', 'Restaurante', 1, 45),
(2, 'Té frío de frutos rojos', 'Bebida fría natural con frutos rojos.', 1800, 'te_frio.jpg', 'Restaurante', 1, 40),
(3, 'Sándwich de pollo', 'Sándwich artesanal con pollo y vegetales.', 3500, 'sandwich_pollo.jpg', 'Restaurante', 1, 30),
(4, 'Queque de zanahoria', 'Postre artesanal con zanahoria y nueces.', 2000, 'queque_zanahoria.jpg', 'Restaurante', 1, 25),

(5, 'Monstera Deliciosa', 'Planta tropical de interior con hojas grandes.', 8500, 'monstera.jpg', 'Planta', 1, 15),
(5, 'Sansevieria', 'Planta resistente ideal para interiores.', 6500, 'sansevieria.jpg', 'Planta', 1, 20),
(5, 'Pothos Dorado', 'Planta colgante de fácil cuidado.', 4500, 'pothos.jpg', 'Planta', 1, 25),
(6, 'Lavanda', 'Planta aromática para exteriores soleados.', 3800, 'lavanda.jpg', 'Planta', 1, 18),
(6, 'Jazmín Estrella', 'Planta ornamental trepadora con flores aromáticas.', 5200, 'jazmin.jpg', 'Planta', 1, 12),

(7, 'Maceta de barro mediana', 'Maceta artesanal de barro.', 3200, 'maceta_barro.jpg', 'ProductoVivero', 1, 35),
(7, 'Maceta decorativa blanca', 'Maceta moderna para interiores.', 4500, 'maceta_blanca.jpg', 'ProductoVivero', 1, 20),
(8, 'Fertilizante orgánico', 'Fertilizante natural para plantas ornamentales.', 2800, 'fertilizante.jpg', 'ProductoVivero', 1, 40),
(9, 'Kit de jardinería básico', 'Herramientas básicas para cuidado de plantas.', 9500, 'kit_jardineria.jpg', 'ProductoVivero', 1, 10);

INSERT INTO Plantas
(IdProducto, TipoClima, TemperaturaRecomendada, FrecuenciaRiego, NivelLuz, TipoSuelo, CuidadosEspeciales, TamanoAproximado, NivelDificultad, TieneQR, CodigoQR)
VALUES
(6, 'Tropical húmedo', '18°C - 28°C', '2 veces por semana', 'Luz indirecta brillante', 'Suelo fértil y drenado', 'Evitar sol directo fuerte.', 'Mediana a grande', 'Media', 1, 'QR-MONSTERA-001'),
(7, 'Cálido seco', '16°C - 30°C', 'Cada 10 a 15 días', 'Luz indirecta o semisombra', 'Suelo bien drenado', 'No exceder el riego.', 'Mediana', 'Fácil', 1, 'QR-SANSEVIERIA-002'),
(8, 'Tropical', '18°C - 30°C', '1 o 2 veces por semana', 'Luz indirecta', 'Suelo liviano', 'Puede crecer en agua.', 'Pequeña a mediana', 'Fácil', 1, 'QR-POTHOS-003'),
(9, 'Templado seco', '15°C - 27°C', 'Cada 3 a 4 días', 'Sol directo', 'Suelo arenoso', 'Podar flores secas.', 'Pequeña', 'Media', 1, 'QR-LAVANDA-004'),
(10, 'Templado tropical', '16°C - 28°C', '2 veces por semana', 'Sol parcial', 'Suelo fértil', 'Necesita soporte para trepar.', 'Grande', 'Media', 1, 'QR-JAZMIN-005');

INSERT INTO PreguntasRecomendador (Pregunta) VALUES
('¿Desea una planta para interior o exterior?'),
('¿Cuánta luz recibe el lugar?'),
('¿Tiene mascotas en casa?'),
('¿Cuánto tiempo puede dedicar al cuidado?'),
('¿Qué tipo de clima tiene el espacio?');

INSERT INTO OpcionesRecomendador (IdPregunta, TextoOpcion, Valor) VALUES
(1, 'Interior', 'Interior'),
(1, 'Exterior', 'Exterior'),
(2, 'Poca luz', 'Poca'),
(2, 'Luz indirecta', 'Indirecta'),
(2, 'Sol directo', 'Directa'),
(3, 'Sí, tengo mascotas', 'Si'),
(3, 'No tengo mascotas', 'No'),
(4, 'Poco tiempo', 'Bajo'),
(4, 'Tiempo moderado', 'Medio'),
(4, 'Mucho tiempo', 'Alto'),
(5, 'Tropical húmedo', 'TropicalHumedo'),
(5, 'Cálido seco', 'CalidoSeco'),
(5, 'Templado', 'Templado');

INSERT INTO RecomendacionesPlantas
(IdPlanta, InteriorExterior, NivelLuz, TieneMascotas, TiempoCuidado, TipoClima)
VALUES
(1, 'Interior', 'Luz indirecta brillante', 0, 'Medio', 'Tropical húmedo'),
(2, 'Interior', 'Luz indirecta o semisombra', 1, 'Bajo', 'Cálido seco'),
(3, 'Interior', 'Luz indirecta', 1, 'Bajo', 'Tropical'),
(4, 'Exterior', 'Sol directo', 0, 'Medio', 'Templado seco'),
(5, 'Exterior', 'Sol parcial', 0, 'Medio', 'Templado tropical');

INSERT INTO Carritos (IdUsuario, Estado) VALUES
(1, 'Activo'),
(2, 'Activo');

INSERT INTO CarritoDetalle
(IdCarrito, IdProducto, Cantidad, PrecioUnitario)
VALUES
(1, 1, 2, 2200),
(1, 6, 1, 8500),
(1, 11, 1, 3200),
(2, 4, 1, 3500),
(2, 8, 1, 4500);

INSERT INTO Compras
(IdUsuario, Subtotal, Impuesto, Total, MetodoEntrega, DireccionEntrega, EstadoCompra)
VALUES
(1, 15900, 2067, 17967, 'Retiro en tienda', NULL, 'Confirmada'),
(2, 8000, 1040, 9040, 'Entrega a domicilio', 'San José, Costa Rica', 'Pendiente');

INSERT INTO CompraDetalle
(IdCompra, IdProducto, Cantidad, PrecioUnitario, Subtotal)
VALUES
(1, 1, 2, 2200, 4400),
(1, 6, 1, 8500, 8500),
(1, 11, 1, 3200, 3200),
(2, 4, 1, 3500, 3500),
(2, 8, 1, 4500, 4500);

INSERT INTO Reservaciones
(IdUsuario, FechaReservacion, HoraReservacion, CantidadPersonas, Estado, Comentarios)
VALUES
(1, '2026-06-15', '18:30', 2, 'Confirmada', 'Mesa cerca del jardín.'),
(2, '2026-06-18', '12:00', 4, 'Pendiente', 'Celebración familiar.');

INSERT INTO JardinVirtual
(IdUsuario, IdPlanta, NombrePersonalizado, FechaAdquisicion, EstadoPlanta, Notas)
VALUES
(1, 1, 'Mi Monstera', '2026-06-03', 'Saludable', 'Ubicada en la sala.'),
(1, 3, 'Pothos de cocina', '2026-06-04', 'Saludable', 'Recibe luz indirecta.'),
(2, 2, 'Lengua de suegra', '2026-06-05', 'Necesita revisión', 'Revisar humedad del suelo.');

INSERT INTO CuidadosPlantas
(IdJardin, TipoCuidado, FechaProgramada, Realizado, FechaRealizado, Observacion)
VALUES
(1, 'Riego', '2026-06-06', 1, '2026-06-06 08:00:00', 'Riego realizado correctamente.'),
(1, 'Fertilización', '2026-06-20', 0, NULL, 'Aplicar fertilizante orgánico.'),
(2, 'Riego', '2026-06-07', 0, NULL, 'Riego pendiente.'),
(3, 'Revisión general', '2026-06-08', 0, NULL, 'Verificar hojas amarillas.');

INSERT INTO Notificaciones
(IdUsuario, Titulo, Mensaje, Tipo, Leida)
VALUES
(1, 'Compra confirmada', 'Su compra fue registrada correctamente.', 'Compra', 0),
(1, 'Riego pendiente', 'Hoy debe regar su Pothos de cocina.', 'Cuidado', 0),
(2, 'Reservación pendiente', 'Su reservación está pendiente de confirmación.', 'Reserva', 0),
(2, 'Nueva promoción', 'Disfrute café latte con descuento este fin de semana.', 'Promoción', 1);

INSERT INTO Promociones
(Titulo, Descripcion, FechaInicio, FechaFin, Estado)
VALUES
('Combo Café + Planta', 'Compre un café latte y obtenga 10% de descuento en plantas de interior.', '2026-06-01', '2026-06-15', 1),
('Semana Verde', 'Descuentos especiales en macetas y fertilizantes.', '2026-06-10', '2026-06-20', 1);

INSERT INTO Calificaciones
(IdUsuario, IdProducto, Puntuacion)
VALUES
(1, 6, 5),
(1, 1, 4),
(2, 8, 5),
(2, 4, 4);

INSERT INTO Comentarios
(IdUsuario, IdProducto, Comentario)
VALUES
(1, 6, 'La Monstera llegó en excelente estado y muy bonita.'),
(1, 1, 'Muy buen café, sabor suave y agradable.'),
(2, 8, 'El Pothos es fácil de cuidar, ideal para interiores.'),
(2, 4, 'El sándwich estaba fresco y bien preparado.');

INSERT INTO Auditoria
(IdUsuario, Accion, TablaAfectada, Detalle)
VALUES
(4, 'Registro de producto', 'Productos', 'El administrador registró productos iniciales.'),
(4, 'Actualización de inventario', 'Productos', 'Se actualizaron existencias del vivero.'),
(3, 'Confirmación de reservación', 'Reservaciones', 'Empleado confirmó una reservación.'),
(4, 'Creación de promoción', 'Promociones', 'Se creó la promoción Combo Café + Planta.');

-- ============================================================
-- CORRECCIONES: garantizar que las categorías del vivero
-- tengan Tipo = 'Vivero' y que los productos apunten a ellas
-- ============================================================

UPDATE Categorias
SET Tipo = 'Vivero'
WHERE NombreCategoria IN ('Macetas', 'Fertilizantes', 'Herramientas');

UPDATE p
SET p.IdCategoria = c.IdCategoria
FROM Productos p
INNER JOIN Categorias c ON c.NombreCategoria = 'Macetas'
WHERE p.Nombre IN ('Maceta de barro mediana', 'Maceta decorativa blanca');

UPDATE p
SET p.IdCategoria = c.IdCategoria
FROM Productos p
INNER JOIN Categorias c ON c.NombreCategoria = 'Fertilizantes'
WHERE p.Nombre = 'Fertilizante orgánico';

UPDATE p
SET p.IdCategoria = c.IdCategoria
FROM Productos p
INNER JOIN Categorias c ON c.NombreCategoria = 'Herramientas'
WHERE p.Nombre = 'Kit de jardinería básico';
GO