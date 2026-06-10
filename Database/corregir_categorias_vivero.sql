USE tiusr15pl_RaicesCafeVivero;
GO

-- Ver qué categorías existen actualmente
SELECT IdCategoria, NombreCategoria, Tipo FROM Categorias ORDER BY IdCategoria;
GO

-- Insertar las categorías que faltan (si no existen ya con ese nombre)
IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Macetas')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Macetas', 'Vivero');
ELSE
    UPDATE Categorias SET Tipo = 'Vivero' WHERE NombreCategoria = 'Macetas';

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Fertilizantes')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Fertilizantes', 'Vivero');
ELSE
    UPDATE Categorias SET Tipo = 'Vivero' WHERE NombreCategoria = 'Fertilizantes';

IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Herramientas')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Herramientas', 'Vivero');
ELSE
    UPDATE Categorias SET Tipo = 'Vivero' WHERE NombreCategoria = 'Herramientas';
GO

-- Actualizar los productos existentes para que apunten a las categorías correctas
UPDATE p SET p.IdCategoria = c.IdCategoria
FROM Productos p, Categorias c
WHERE c.NombreCategoria = 'Macetas'
  AND p.Nombre IN ('Maceta de barro mediana', 'Maceta decorativa blanca');

UPDATE p SET p.IdCategoria = c.IdCategoria
FROM Productos p, Categorias c
WHERE c.NombreCategoria = 'Fertilizantes'
  AND p.Nombre IN ('Fertilizante orgánico');

UPDATE p SET p.IdCategoria = c.IdCategoria
FROM Productos p, Categorias c
WHERE c.NombreCategoria = 'Herramientas'
  AND p.Nombre IN ('Kit de jardinería básico');
GO

-- Verificar resultado final
SELECT p.IdProducto, p.Nombre, c.NombreCategoria, c.Tipo, p.TipoProducto
FROM Productos p
INNER JOIN Categorias c ON p.IdCategoria = c.IdCategoria
WHERE c.Tipo = 'Vivero' AND p.Disponible >= 1
ORDER BY p.IdProducto;
GO
