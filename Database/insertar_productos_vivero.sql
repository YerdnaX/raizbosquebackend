USE tiusr15pl_RaicesCafeVivero;
GO

-- Insertar categorías del vivero si no existen
IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Macetas')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Macetas', 'Vivero');

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Fertilizantes')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Fertilizantes', 'Vivero');

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Herramientas')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Herramientas', 'Vivero');

GO

-- Insertar productos de macetas
INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
SELECT IdCategoria, 'Maceta de barro mediana', 'Maceta artesanal de barro.', 3200, 'maceta_barro.jpg', 'ProductoVivero', 1, 35
FROM Categorias WHERE NombreCategoria = 'Macetas';

INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
SELECT IdCategoria, 'Maceta decorativa blanca', 'Maceta moderna para interiores.', 4500, 'maceta_blanca.jpg', 'ProductoVivero', 1, 20
FROM Categorias WHERE NombreCategoria = 'Macetas';

-- Insertar fertilizantes
INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
SELECT IdCategoria, 'Fertilizante orgánico', 'Fertilizante natural para plantas ornamentales.', 2800, 'fertilizante.jpg', 'ProductoVivero', 1, 40
FROM Categorias WHERE NombreCategoria = 'Fertilizantes';

-- Insertar herramientas
INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
SELECT IdCategoria, 'Kit de jardinería básico', 'Herramientas básicas para cuidado de plantas.', 9500, 'kit_jardineria.jpg', 'ProductoVivero', 1, 10
FROM Categorias WHERE NombreCategoria = 'Herramientas';

GO

-- Verificar resultado
SELECT p.IdProducto, p.Nombre, c.NombreCategoria, p.TipoProducto
FROM Productos p
INNER JOIN Categorias c ON p.IdCategoria = c.IdCategoria
WHERE c.Tipo = 'Vivero' AND p.Disponible >= 1
ORDER BY p.IdProducto;
GO
