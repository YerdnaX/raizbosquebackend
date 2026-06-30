-- ============================================================
-- triggers_auditoria_autenticacion.sql
-- Tablas y triggers para auditoría de login y cambio de contraseña.
-- Idempotente: usa DROP IF EXISTS antes de CREATE.
-- Requiere que creadorDB.sql o cambios_seguridad_autenticacion.sql
-- se hayan ejecutado primero.
-- ============================================================

USE tiusr15pl_RaicesCafeVivero;
GO

-- ------------------------------------------------------------
-- Tabla: HistorialLogin (auditoría ampliada de cada intento)
-- AuditoriaLogin (ya creada) almacena el registro principal.
-- Este trigger enriquece la tabla Auditoria general con un
-- resumen legible por el administrador.
-- ------------------------------------------------------------

-- Trigger en AuditoriaLogin: copia un resumen a Auditoria general
IF OBJECT_ID('TR_AuditoriaLogin_Insertar', 'TR') IS NOT NULL
    DROP TRIGGER TR_AuditoriaLogin_Insertar;
GO

CREATE TRIGGER TR_AuditoriaLogin_Insertar
ON AuditoriaLogin
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Auditoria (IdUsuario, Accion, TablaAfectada, Detalle)
    SELECT
        i.IdUsuario,
        'Intento de inicio de sesión: ' + i.Resultado,
        'AuditoriaLogin',
        'Correo: ' + ISNULL(i.CorreoIngresado, '') +
        ' | IP: ' + ISNULL(i.DireccionIP, 'desconocida') +
        ' | Motivo: ' + ISNULL(i.Motivo, '')
    FROM inserted i;
END;
GO

-- ------------------------------------------------------------
-- Trigger en AuditoriaContrasena: copia resumen a Auditoria
-- ------------------------------------------------------------

IF OBJECT_ID('TR_AuditoriaContrasena_Insertar', 'TR') IS NOT NULL
    DROP TRIGGER TR_AuditoriaContrasena_Insertar;
GO

CREATE TRIGGER TR_AuditoriaContrasena_Insertar
ON AuditoriaContrasena
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Auditoria (IdUsuario, Accion, TablaAfectada, Detalle)
    SELECT
        i.IdUsuario,
        'Cambio de contraseña: ' + ISNULL(i.Motivo, 'MANUAL'),
        'AuditoriaContrasena',
        'Expira: ' + ISNULL(CONVERT(VARCHAR, i.FechaExpiracionNueva, 120), 'N/A') +
        ' | Bloqueado antes: ' + ISNULL(CAST(i.EstadoBloqueoPrevio AS VARCHAR), 'N/A') +
        ' | Bloqueado después: ' + ISNULL(CAST(i.EstadoBloqueoPosterior AS VARCHAR), 'N/A')
    FROM inserted i;
END;
GO

-- ------------------------------------------------------------
-- Trigger en Usuarios: detecta cambio de CuentaBloqueada y lo registra
-- ------------------------------------------------------------

IF OBJECT_ID('TR_Usuarios_CambioBloqueo', 'TR') IS NOT NULL
    DROP TRIGGER TR_Usuarios_CambioBloqueo;
GO

CREATE TRIGGER TR_Usuarios_CambioBloqueo
ON Usuarios
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Solo actúa cuando CuentaBloqueada o IntentosFallidos cambia
    IF NOT UPDATE(CuentaBloqueada) AND NOT UPDATE(IntentosFallidos)
        RETURN;

    INSERT INTO Auditoria (IdUsuario, Accion, TablaAfectada, Detalle)
    SELECT
        i.IdUsuario,
        CASE
            WHEN i.CuentaBloqueada = 1 AND d.CuentaBloqueada = 0 THEN 'Cuenta bloqueada por intentos fallidos'
            WHEN i.CuentaBloqueada = 0 AND d.CuentaBloqueada = 1 THEN 'Cuenta desbloqueada tras cambio de contraseña'
            ELSE 'Actualización de intentos fallidos: ' + CAST(i.IntentosFallidos AS VARCHAR)
        END,
        'Usuarios',
        'Intentos fallidos: ' + CAST(i.IntentosFallidos AS VARCHAR) +
        ' | Bloqueada: ' + CAST(i.CuentaBloqueada AS VARCHAR)
    FROM inserted i
    INNER JOIN deleted d ON i.IdUsuario = d.IdUsuario
    WHERE i.CuentaBloqueada != d.CuentaBloqueada
       OR i.IntentosFallidos != d.IntentosFallidos;
END;
GO

-- ------------------------------------------------------------
-- Vista de auditoría de login para administradores
-- ------------------------------------------------------------

IF OBJECT_ID('V_AuditoriaLoginDetalle', 'V') IS NOT NULL
    DROP VIEW V_AuditoriaLoginDetalle;
GO

CREATE VIEW V_AuditoriaLoginDetalle AS
SELECT
    al.IdAuditoria,
    al.FechaIntento,
    al.CorreoIngresado,
    u.Nombre        AS NombreUsuario,
    u.Apellidos     AS ApellidosUsuario,
    al.Resultado,
    al.Motivo,
    al.DireccionIP,
    al.UserAgent
FROM AuditoriaLogin al
LEFT JOIN Usuarios u ON al.IdUsuario = u.IdUsuario;
GO

-- ------------------------------------------------------------
-- Vista de auditoría de contraseñas para administradores
-- ------------------------------------------------------------

IF OBJECT_ID('V_AuditoriaContrasenaDetalle', 'V') IS NOT NULL
    DROP VIEW V_AuditoriaContrasenaDetalle;
GO

CREATE VIEW V_AuditoriaContrasenaDetalle AS
SELECT
    ac.IdAuditoria,
    ac.FechaCambio,
    u.Correo                  AS CorreoUsuario,
    u.Nombre                  AS NombreUsuario,
    ac.Motivo,
    ac.FechaExpiracionNueva,
    ac.EstadoBloqueoPrevio,
    ac.EstadoBloqueoPosterior
FROM AuditoriaContrasena ac
INNER JOIN Usuarios u ON ac.IdUsuario = u.IdUsuario;
GO
