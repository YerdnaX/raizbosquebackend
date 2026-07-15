-- ============================================================
-- 005_dejar_solo_admin.sql
-- Elimina todos los usuarios del sistema y deja unicamente
-- el administrador principal con la contrasena indicada.
-- ============================================================

USE tiusr15pl_RaicesCafeVivero;
GO

SET NOCOUNT ON;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @IdRolAdmin INT = (
        SELECT TOP (1) IdRol
        FROM Roles
        WHERE NombreRol = 'Administrador'
        ORDER BY IdRol
    );

    IF @IdRolAdmin IS NULL
        RAISERROR('No existe el rol Administrador en la tabla Roles.', 16, 1);

    IF OBJECT_ID('CodigosVerificacion', 'U') IS NOT NULL
        DELETE FROM CodigosVerificacion;

    IF OBJECT_ID('TokensTemporal', 'U') IS NOT NULL
        DELETE FROM TokensTemporal;

    IF OBJECT_ID('AuditoriaLogin', 'U') IS NOT NULL
        DELETE FROM AuditoriaLogin;

    IF OBJECT_ID('CuidadosPlantas', 'U') IS NOT NULL
        DELETE FROM CuidadosPlantas;

    IF OBJECT_ID('JardinVirtual', 'U') IS NOT NULL
        DELETE FROM JardinVirtual;

    IF OBJECT_ID('CarritoDetalle', 'U') IS NOT NULL
        DELETE FROM CarritoDetalle;

    IF OBJECT_ID('Carritos', 'U') IS NOT NULL
        DELETE FROM Carritos;

    IF OBJECT_ID('CompraDetalle', 'U') IS NOT NULL
        DELETE FROM CompraDetalle;

    IF OBJECT_ID('Compras', 'U') IS NOT NULL
        DELETE FROM Compras;

    IF OBJECT_ID('Reservaciones', 'U') IS NOT NULL
        DELETE FROM Reservaciones;

    IF OBJECT_ID('Notificaciones', 'U') IS NOT NULL
        DELETE FROM Notificaciones;

    IF OBJECT_ID('Calificaciones', 'U') IS NOT NULL
        DELETE FROM Calificaciones;

    IF OBJECT_ID('Comentarios', 'U') IS NOT NULL
        DELETE FROM Comentarios;

    IF OBJECT_ID('AuditoriaContrasena', 'U') IS NOT NULL
        DELETE FROM AuditoriaContrasena;

    IF OBJECT_ID('RespuestasSeguridad', 'U') IS NOT NULL
        DELETE FROM RespuestasSeguridad;

    IF OBJECT_ID('Auditoria', 'U') IS NOT NULL
        DELETE FROM Auditoria;

    DELETE FROM Usuarios;

    SET IDENTITY_INSERT Usuarios ON;

    INSERT INTO Usuarios (
        IdUsuario,
        IdRol,
        Nombre,
        Apellidos,
        Correo,
        Telefono,
        Direccion,
        Contrasena,
        NombreUsuario,
        ContrasenaHash,
        FechaCreacionContrasena,
        FechaExpiracionContrasena,
        IntentosFallidos,
        CuentaBloqueada,
        FechaBloqueo,
        CorreoVerificado,
        Estado,
        FechaRegistro
    )
    VALUES (
        4,
        @IdRolAdmin,
        'Admin',
        'Principal',
        'admin@raices.com',
        '8888-9998',
        'Raices Cafe & Vivero',
        'Admin123!',
        'adminprincipal',
        '$2b$10$70/aKrc5P60/VRrVZyqFSOiuSUp4EA05L1hQgbc8sE8ZEDFw8kOy2',
        '2026-06-30T10:17:01.170',
        '2026-10-28T10:17:01.170',
        0,
        0,
        NULL,
        1,
        1,
        '2026-06-08T17:17:38.780'
    );

    SET IDENTITY_INSERT Usuarios OFF;

    IF COL_LENGTH('Usuarios', 'TwoFactorEnabled') IS NOT NULL
    BEGIN
        UPDATE Usuarios
        SET TwoFactorEnabled = 0,
            TwoFactorMethod = NULL,
            TwoFactorSecretEncrypted = NULL,
            TwoFactorDeviceLinkedAt = NULL,
            TwoFactorCreatedAt = NULL,
            TwoFactorUpdatedAt = NULL
        WHERE IdUsuario = 4;
    END

    DBCC CHECKIDENT ('Usuarios', RESEED, 4);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    IF OBJECT_ID('Usuarios', 'U') IS NOT NULL AND IDENT_CURRENT('Usuarios') IS NOT NULL
    BEGIN
        BEGIN TRY
            SET IDENTITY_INSERT Usuarios OFF;
        END TRY
        BEGIN CATCH
        END CATCH
    END

    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState INT = ERROR_STATE();

    RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH;
GO

SELECT
    IdUsuario,
    IdRol,
    Nombre,
    Apellidos,
    Correo,
    Telefono,
    Direccion,
    NombreUsuario,
    FechaCreacionContrasena,
    FechaExpiracionContrasena,
    IntentosFallidos,
    CuentaBloqueada,
    FechaBloqueo,
    CorreoVerificado,
    Estado,
    FechaRegistro,
    CASE WHEN COL_LENGTH('Usuarios', 'TwoFactorEnabled') IS NOT NULL THEN CAST(TwoFactorEnabled AS INT) END AS TwoFactorEnabled,
    CASE WHEN COL_LENGTH('Usuarios', 'TwoFactorMethod') IS NOT NULL THEN TwoFactorMethod END AS TwoFactorMethod,
    CASE WHEN COL_LENGTH('Usuarios', 'TwoFactorSecretEncrypted') IS NOT NULL THEN TwoFactorSecretEncrypted END AS TwoFactorSecretEncrypted,
    CASE WHEN COL_LENGTH('Usuarios', 'TwoFactorDeviceLinkedAt') IS NOT NULL THEN TwoFactorDeviceLinkedAt END AS TwoFactorDeviceLinkedAt,
    CASE WHEN COL_LENGTH('Usuarios', 'TwoFactorCreatedAt') IS NOT NULL THEN TwoFactorCreatedAt END AS TwoFactorCreatedAt,
    CASE WHEN COL_LENGTH('Usuarios', 'TwoFactorUpdatedAt') IS NOT NULL THEN TwoFactorUpdatedAt END AS TwoFactorUpdatedAt
FROM Usuarios;
GO

PRINT 'Proceso completado: se elimino todo el catalogo de usuarios y se dejo solo admin@raices.com / adminprincipal.';
PRINT 'Contrasena configurada: Admin123!';
GO