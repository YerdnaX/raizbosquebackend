USE tiusr15pl_RaicesCafeVivero;
GO

IF COL_LENGTH('Productos', 'IdProductoProvedor') IS NULL
BEGIN
    ALTER TABLE Productos
    ADD IdProductoProvedor INT NULL;
END;
GO

-- Si existen columnas anteriores, conservar sus valores antes de eliminarlas.
IF COL_LENGTH('Productos', 'IdProductoProvedorVivero') IS NOT NULL
BEGIN
    UPDATE Productos
    SET IdProductoProvedor = IdProductoProvedorVivero
    WHERE TipoProducto = 'Planta'
      AND IdProductoProvedor IS NULL
      AND IdProductoProvedorVivero IS NOT NULL;
END;
GO

IF COL_LENGTH('Productos', 'IdProductoProvedorProductos') IS NOT NULL
BEGIN
    UPDATE Productos
    SET IdProductoProvedor = IdProductoProvedorProductos
    WHERE TipoProducto = 'ProductoVivero'
      AND IdProductoProvedor IS NULL
      AND IdProductoProvedorProductos IS NOT NULL;
END;
GO

-- Valores seed del provedor-vivero, usado por productos TipoProducto = 'Planta'.
UPDATE Productos SET IdProductoProvedor = 1 WHERE Nombre = 'Monstera Deliciosa';
UPDATE Productos SET IdProductoProvedor = 2 WHERE Nombre = 'Sansevieria';
UPDATE Productos SET IdProductoProvedor = 3 WHERE Nombre = 'Pothos Dorado';
UPDATE Productos SET IdProductoProvedor = 4 WHERE Nombre = 'Lavanda';
UPDATE Productos SET IdProductoProvedor = 5 WHERE Nombre = 'Jazmín Estrella';

-- Valores seed del provedor-productos, usado por productos TipoProducto = 'ProductoVivero'.
UPDATE Productos SET IdProductoProvedor = 1 WHERE Nombre = 'Maceta de barro mediana';
UPDATE Productos SET IdProductoProvedor = 2 WHERE Nombre = 'Maceta decorativa blanca';
UPDATE Productos SET IdProductoProvedor = 3 WHERE Nombre = 'Fertilizante orgánico';
UPDATE Productos SET IdProductoProvedor = 4 WHERE Nombre = 'Kit de jardinería básico';
GO

IF COL_LENGTH('Productos', 'IdProductoProvedorVivero') IS NOT NULL
BEGIN
    ALTER TABLE Productos
    DROP COLUMN IdProductoProvedorVivero;
END;
GO

IF COL_LENGTH('Productos', 'IdProductoProvedorProductos') IS NOT NULL
BEGIN
    ALTER TABLE Productos
    DROP COLUMN IdProductoProvedorProductos;
END;
GO

SELECT IdProducto, Nombre, TipoProducto, IdProductoProvedor
FROM Productos
WHERE IdProductoProvedor IS NOT NULL
ORDER BY IdProducto;
GO
