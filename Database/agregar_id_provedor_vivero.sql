USE tiusr15pl_RaicesCafeVivero;
GO

IF COL_LENGTH('Productos', 'IdProductoProvedorVivero') IS NULL
BEGIN
    ALTER TABLE Productos
    ADD IdProductoProvedorVivero INT NULL;
END;
GO

UPDATE Productos SET IdProductoProvedorVivero = 1 WHERE Nombre = 'Monstera Deliciosa';
UPDATE Productos SET IdProductoProvedorVivero = 2 WHERE Nombre = 'Sansevieria';
UPDATE Productos SET IdProductoProvedorVivero = 3 WHERE Nombre = 'Pothos Dorado';
UPDATE Productos SET IdProductoProvedorVivero = 4 WHERE Nombre = 'Lavanda';
UPDATE Productos SET IdProductoProvedorVivero = 5 WHERE Nombre IN ('Jazmin Estrella', 'Jazmín Estrella');
UPDATE Productos SET IdProductoProvedorVivero = 6 WHERE Nombre = 'Maceta de barro mediana';
UPDATE Productos SET IdProductoProvedorVivero = 7 WHERE Nombre = 'Maceta decorativa blanca';
UPDATE Productos SET IdProductoProvedorVivero = 8 WHERE Nombre IN ('Fertilizante organico', 'Fertilizante orgánico');
UPDATE Productos SET IdProductoProvedorVivero = 9 WHERE Nombre IN ('Kit de jardineria basico', 'Kit de jardinería básico');
GO

SELECT IdProducto, Nombre, IdProductoProvedorVivero
FROM Productos
WHERE IdProductoProvedorVivero IS NOT NULL
ORDER BY IdProducto;
GO
