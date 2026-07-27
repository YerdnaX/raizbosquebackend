USE tiusr15pl_RaicesCafeVivero;
GO

IF COL_LENGTH('Productos', 'IdProductoProvedorVivero') IS NULL
BEGIN
    ALTER TABLE Productos
    ADD IdProductoProvedorVivero INT NULL;
END;
GO

IF COL_LENGTH('Productos', 'IdProductoProvedorProductos') IS NULL
BEGIN
    ALTER TABLE Productos
    ADD IdProductoProvedorProductos INT NULL;
END;
GO

UPDATE Productos SET IdProductoProvedorVivero = 1 WHERE Nombre = 'Monstera Deliciosa';
UPDATE Productos SET IdProductoProvedorVivero = 2 WHERE Nombre = 'Sansevieria';
UPDATE Productos SET IdProductoProvedorVivero = 3 WHERE Nombre = 'Pothos Dorado';
UPDATE Productos SET IdProductoProvedorVivero = 4 WHERE Nombre = 'Lavanda';
UPDATE Productos SET IdProductoProvedorVivero = 5 WHERE Nombre IN ('Jazmin Estrella', 'Jazmín Estrella');

UPDATE Productos SET IdProductoProvedorProductos = 1 WHERE Nombre = 'Maceta de barro mediana';
UPDATE Productos SET IdProductoProvedorProductos = 2 WHERE Nombre = 'Maceta decorativa blanca';
UPDATE Productos SET IdProductoProvedorProductos = 3 WHERE Nombre = 'Fertilizante orgánico';
UPDATE Productos SET IdProductoProvedorProductos = 4 WHERE Nombre = 'Kit de jardinería básico';
GO

SELECT IdProducto, Nombre, IdProductoProvedorVivero, IdProductoProvedorProductos
FROM Productos
WHERE IdProductoProvedorVivero IS NOT NULL
   OR IdProductoProvedorProductos IS NOT NULL
ORDER BY IdProducto;
GO
