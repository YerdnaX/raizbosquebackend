-- ============================================================
-- limpiar_seguridad.sql
-- Limpia TODOS los datos de las tablas de autenticación/seguridad
-- y elimina los usuarios de prueba (@test.com) con todos sus datos.
-- Los usuarios originales (carlos@email.com, etc.) se conservan,
-- pero se resetean sus columnas de seguridad para poder re-seedear.
--
-- Ejecutar ANTES de seed_autenticacion.js cuando se quiera empezar limpio.
-- ============================================================

USE tiusr15pl_RaicesCafeVivero;
GO

-- ============================================================
-- PASO 1: Limpiar tablas de seguridad temporales (sin FK a Usuarios)
-- ============================================================

IF OBJECT_ID('CodigosVerificacion', 'U') IS NOT NULL
    DELETE FROM CodigosVerificacion;
GO

IF OBJECT_ID('TokensTemporal', 'U') IS NOT NULL
    DELETE FROM TokensTemporal;
GO

-- ============================================================
-- PASO 2: Limpiar auditoría de login (IdUsuario es nullable)
-- ============================================================

IF OBJECT_ID('AuditoriaLogin', 'U') IS NOT NULL
    DELETE FROM AuditoriaLogin;
GO

-- ============================================================
-- PASO 3: Eliminar datos dependientes de usuarios @test.com
--         en orden correcto de claves foráneas
-- ============================================================

-- 3a. CuidadosPlantas (depende de JardinVirtual)
IF OBJECT_ID('CuidadosPlantas', 'U') IS NOT NULL
    DELETE cp FROM CuidadosPlantas cp
    INNER JOIN JardinVirtual jv ON cp.IdJardin = jv.IdJardin
    INNER JOIN Usuarios u ON jv.IdUsuario = u.IdUsuario
    WHERE u.Correo LIKE '%@test.com';
GO

-- 3b. JardinVirtual
IF OBJECT_ID('JardinVirtual', 'U') IS NOT NULL
    DELETE jv FROM JardinVirtual jv
    INNER JOIN Usuarios u ON jv.IdUsuario = u.IdUsuario
    WHERE u.Correo LIKE '%@test.com';
GO

-- 3c. CarritoDetalle (depende de Carritos)
IF OBJECT_ID('CarritoDetalle', 'U') IS NOT NULL
    DELETE cd FROM CarritoDetalle cd
    INNER JOIN Carritos c ON cd.IdCarrito = c.IdCarrito
    INNER JOIN Usuarios u ON c.IdUsuario = u.IdUsuario
    WHERE u.Correo LIKE '%@test.com';
GO

-- 3d. Carritos
IF OBJECT_ID('Carritos', 'U') IS NOT NULL
    DELETE c FROM Carritos c
    INNER JOIN Usuarios u ON c.IdUsuario = u.IdUsuario
    WHERE u.Correo LIKE '%@test.com';
GO

-- 3e. CompraDetalle (depende de Compras)
IF OBJECT_ID('CompraDetalle', 'U') IS NOT NULL
    DELETE cd FROM CompraDetalle cd
    INNER JOIN Compras co ON cd.IdCompra = co.IdCompra
    INNER JOIN Usuarios u ON co.IdUsuario = u.IdUsuario
    WHERE u.Correo LIKE '%@test.com';
GO

-- 3f. Compras
IF OBJECT_ID('Compras', 'U') IS NOT NULL
    DELETE co FROM Compras co
    INNER JOIN Usuarios u ON co.IdUsuario = u.IdUsuario
    WHERE u.Correo LIKE '%@test.com';
GO

-- 3g. Reservaciones
IF OBJECT_ID('Reservaciones', 'U') IS NOT NULL
    DELETE r FROM Reservaciones r
    INNER JOIN Usuarios u ON r.IdUsuario = u.IdUsuario
    WHERE u.Correo LIKE '%@test.com';
GO

-- 3h. Notificaciones
IF OBJECT_ID('Notificaciones', 'U') IS NOT NULL
    DELETE n FROM Notificaciones n
    INNER JOIN Usuarios u ON n.IdUsuario = u.IdUsuario
    WHERE u.Correo LIKE '%@test.com';
GO

-- 3i. Calificaciones
IF OBJECT_ID('Calificaciones', 'U') IS NOT NULL
    DELETE cal FROM Calificaciones cal
    INNER JOIN Usuarios u ON cal.IdUsuario = u.IdUsuario
    WHERE u.Correo LIKE '%@test.com';
GO

-- 3j. Comentarios
IF OBJECT_ID('Comentarios', 'U') IS NOT NULL
    DELETE co FROM Comentarios co
    INNER JOIN Usuarios u ON co.IdUsuario = u.IdUsuario
    WHERE u.Correo LIKE '%@test.com';
GO

-- 3k. AuditoriaContrasena
IF OBJECT_ID('AuditoriaContrasena', 'U') IS NOT NULL
    DELETE ac FROM AuditoriaContrasena ac
    INNER JOIN Usuarios u ON ac.IdUsuario = u.IdUsuario
    WHERE u.Correo LIKE '%@test.com';
GO

-- 3l. RespuestasSeguridad de usuarios @test.com
IF OBJECT_ID('RespuestasSeguridad', 'U') IS NOT NULL
    DELETE rs FROM RespuestasSeguridad rs
    INNER JOIN Usuarios u ON rs.IdUsuario = u.IdUsuario
    WHERE u.Correo LIKE '%@test.com';
GO

-- 3m. Auditoria general
IF OBJECT_ID('Auditoria', 'U') IS NOT NULL
    DELETE a FROM Auditoria a
    INNER JOIN Usuarios u ON a.IdUsuario = u.IdUsuario
    WHERE u.Correo LIKE '%@test.com';
GO

-- 3n. Eliminar usuarios @test.com
IF OBJECT_ID('Usuarios', 'U') IS NOT NULL
    DELETE FROM Usuarios WHERE Correo LIKE '%@test.com';
GO

-- ============================================================
-- PASO 4: Resetear columnas de seguridad en usuarios existentes
--         (para que el seeder les asigne nuevos valores)
-- ============================================================

IF OBJECT_ID('RespuestasSeguridad', 'U') IS NOT NULL
    DELETE FROM RespuestasSeguridad
    WHERE IdUsuario IN (
        SELECT IdUsuario FROM Usuarios
        WHERE Correo IN ('carlos@email.com','maria@email.com','andrea@raices.com','admin@raices.com')
    );
GO

IF OBJECT_ID('AuditoriaContrasena', 'U') IS NOT NULL
    DELETE FROM AuditoriaContrasena
    WHERE IdUsuario IN (
        SELECT IdUsuario FROM Usuarios
        WHERE Correo IN ('carlos@email.com','maria@email.com','andrea@raices.com','admin@raices.com')
    );
GO

UPDATE Usuarios
SET NombreUsuario            = NULL,
    ContrasenaHash           = NULL,
    FechaCreacionContrasena  = NULL,
    FechaExpiracionContrasena= NULL,
    IntentosFallidos         = 0,
    CuentaBloqueada          = 0,
    FechaBloqueo             = NULL,
    CorreoVerificado         = 1
WHERE Correo IN ('carlos@email.com','maria@email.com','andrea@raices.com','admin@raices.com');
GO

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================

SELECT 'CodigosVerificacion'  AS Tabla, COUNT(*) AS Registros FROM CodigosVerificacion
UNION ALL
SELECT 'TokensTemporal',        COUNT(*) FROM TokensTemporal
UNION ALL
SELECT 'AuditoriaLogin',        COUNT(*) FROM AuditoriaLogin
UNION ALL
SELECT 'AuditoriaContrasena',   COUNT(*) FROM AuditoriaContrasena
UNION ALL
SELECT 'RespuestasSeguridad',   COUNT(*) FROM RespuestasSeguridad
UNION ALL
SELECT 'Usuarios @test.com',    COUNT(*) FROM Usuarios WHERE Correo LIKE '%@test.com'
UNION ALL
SELECT 'Usuarios totales',      COUNT(*) FROM Usuarios;
GO

PRINT '✓ Limpieza completada. Ejecute seed_autenticacion.js para insertar datos de prueba.';
GO
