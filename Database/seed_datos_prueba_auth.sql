-- ============================================================
-- seed_datos_prueba_auth.sql
-- Inserta datos de prueba para el módulo de autenticación.
-- Los hashes bcrypt (10 rondas) ya están pre-calculados.
--
-- REQUISITO: Ejecutar ANTES limpiar_seguridad.sql
--            y haber corrido cambios_seguridad_autenticacion.sql
--
-- ── Credenciales de prueba ────────────────────────────────
--  USUARIO NORMAL
--    Correo:   ana.garcia@test.com   │ Usuario: anagarcia01
--    Clave:    Bosque@2026
--
--  CONTRASEÑA VENCIDA
--    Correo:   carlos.mora@test.com  │ Usuario: carlosmora02
--    Clave:    Vivero#2025
--
--  CUENTA BLOQUEADA
--    Correo:   laura.jimenez@test.com│ Usuario: laurajimenez03
--    Clave:    Jardin!2024           (no funciona hasta recuperar contraseña)
--
--  EMPLEADO ACTIVO
--    Correo:   diego.solis@test.com  │ Usuario: diegosolis04
--    Clave:    Planta_2023Abc!
--
--  ── Usuarios originales actualizados ─────────────────────
--    carlos@email.com   │ carlosramirez  │ Cafe@Bosque1
--    maria@email.com    │ mariafernandez │ Vivero@Luna2
--    andrea@raices.com  │ andreasolano   │ Raices#Sol3
--    admin@raices.com   │ adminprincipal │ Admin@Raiz1!
--
--  ── Respuestas de seguridad (@test.com) ──────────────────
--    P1: ¿Qué color tendría su dragón?
--    P2: ¿Qué planeta visitaría primero?
--    P3: ¿Qué comida defendería en una discusión absurda?
--  !! Respuestas sensibles a mayúsculas y minúsculas !!
--  ── Respuestas legado (carlos, maria, andrea, admin) ─────
--    P1: "Rojo brillante"  P2: "Marte definitivo"  P3: "Casado con arroz"
-- ============================================================

USE tiusr15pl_RaicesCafeVivero;
GO

-- ============================================================
-- PASO 0: Asegurar que Contrasena sea nullable (columna legado)
-- ============================================================
DECLARE @isNullable NVARCHAR(3) = (
    SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Usuarios' AND COLUMN_NAME = 'Contrasena'
);
IF @isNullable = 'NO'
BEGIN
    ALTER TABLE Usuarios ALTER COLUMN Contrasena VARCHAR(255) NULL;
    PRINT 'Columna Contrasena convertida a NULL';
END
GO

-- ============================================================
-- VARIABLES DE ROLES
-- ============================================================
DECLARE @idCliente  INT = (SELECT TOP 1 IdRol FROM Roles WHERE NombreRol = 'Cliente');
DECLARE @idEmpleado INT = (SELECT TOP 1 IdRol FROM Roles WHERE NombreRol = 'Empleado');

IF @idCliente IS NULL OR @idEmpleado IS NULL
BEGIN
    RAISERROR('No se encontraron los roles Cliente/Empleado. Verifique la tabla Roles.', 16, 1);
    RETURN;
END

-- ============================================================
-- 1. ANA GARCIA — Usuario normal activo
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE Correo = 'ana.garcia@test.com')
BEGIN
    INSERT INTO Usuarios (
        IdRol, Nombre, Apellidos, Correo, Telefono, Direccion,
        Contrasena,
        NombreUsuario, ContrasenaHash,
        FechaCreacionContrasena, FechaExpiracionContrasena,
        IntentosFallidos, CuentaBloqueada, FechaBloqueo,
        CorreoVerificado, Estado
    ) VALUES (
        @idCliente,
        'Ana', 'García Vargas', 'ana.garcia@test.com', '87651234', 'San José, Costa Rica',
        'MIGRADO',
        'anagarcia01',
        '$2b$10$DOZgQDvTn9vbpkf08HqUuObujlrzi/ShEwCnCteIHYw0OTZ6Zgd5K',
        GETDATE(), DATEADD(DAY, 120, GETDATE()),
        0, 0, NULL,
        1, 1
    );

    DECLARE @idAna INT = SCOPE_IDENTITY();

    INSERT INTO RespuestasSeguridad (IdUsuario, IdPregunta, RespuestaHash) VALUES
        (@idAna, 1, '$2b$10$QPgSulnq4iJlDWqwx6C2seUwD/jo6mYOHGBP.G4WUXfNVw.xw6fSS'),
        (@idAna, 2, '$2b$10$DhU5hfKxeaj3KANW7JoR9OekoGgXOeY4B7uNwUd.rZoX6Zx6faVYG'),
        (@idAna, 3, '$2b$10$t7hZvAsmzn.isbqGPySNVeuWo1tIHEbfsoviQZqYy/klIYZgLaDvG');

    PRINT 'Ana García insertada (ID=' + CAST(@idAna AS VARCHAR) + ')';
END
ELSE
    PRINT 'Ana García ya existe — omitida';
GO

-- ============================================================
-- 2. CARLOS MORA — Contraseña VENCIDA (hace 10 días)
-- ============================================================
DECLARE @idCliente2 INT = (SELECT TOP 1 IdRol FROM Roles WHERE NombreRol = 'Cliente');

IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE Correo = 'carlos.mora@test.com')
BEGIN
    INSERT INTO Usuarios (
        IdRol, Nombre, Apellidos, Correo, Telefono, Direccion,
        Contrasena,
        NombreUsuario, ContrasenaHash,
        FechaCreacionContrasena, FechaExpiracionContrasena,
        IntentosFallidos, CuentaBloqueada, FechaBloqueo,
        CorreoVerificado, Estado
    ) VALUES (
        @idCliente2,
        'Carlos', 'Mora Jiménez', 'carlos.mora@test.com', '86542345', 'Cartago, Costa Rica',
        'MIGRADO',
        'carlosmora02',
        '$2b$10$ltr3FYshZbIbW.AmRC/pUOXnkdfpwXHzVWZGVKG5dV5vVMSy8Bzmm',
        DATEADD(DAY, -130, GETDATE()),
        DATEADD(DAY, -10,  GETDATE()),
        0, 0, NULL,
        1, 1
    );

    DECLARE @idCarlosMora INT = SCOPE_IDENTITY();

    INSERT INTO RespuestasSeguridad (IdUsuario, IdPregunta, RespuestaHash) VALUES
        (@idCarlosMora, 1, '$2b$10$xf06MQ9E/H8m.T7qkf0gW.q9Vc2ke52WoWokAYQhAjsya4dIvBDzu'),
        (@idCarlosMora, 2, '$2b$10$MdRs0HTxA7vzlWNMDiBpF.0yzlClNsj9zTT0ReitMLP/YMKwWb9PO'),
        (@idCarlosMora, 3, '$2b$10$U33UvDB/uInRtzjdtx0KWej9W14sk1Tr4gJlSx7IXhS7oREHiPj2u');

    PRINT 'Carlos Mora insertado con contraseña VENCIDA (ID=' + CAST(@idCarlosMora AS VARCHAR) + ')';
END
ELSE
    PRINT 'Carlos Mora ya existe — omitido';
GO

-- ============================================================
-- 3. LAURA JIMENEZ — Cuenta BLOQUEADA
-- ============================================================
DECLARE @idCliente3 INT = (SELECT TOP 1 IdRol FROM Roles WHERE NombreRol = 'Cliente');

IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE Correo = 'laura.jimenez@test.com')
BEGIN
    INSERT INTO Usuarios (
        IdRol, Nombre, Apellidos, Correo, Telefono, Direccion,
        Contrasena,
        NombreUsuario, ContrasenaHash,
        FechaCreacionContrasena, FechaExpiracionContrasena,
        IntentosFallidos, CuentaBloqueada, FechaBloqueo,
        CorreoVerificado, Estado
    ) VALUES (
        @idCliente3,
        'Laura', 'Jiménez Castro', 'laura.jimenez@test.com', '85433456', 'Heredia, Costa Rica',
        'MIGRADO',
        'laurajimenez03',
        '$2b$10$ctsIhtejCXV8VC19kuWn6uZnSPOWUbJTVWhNPL.AJaNh.zJDJx3wm',
        GETDATE(), DATEADD(DAY, 120, GETDATE()),
        3, 1, GETDATE(),
        1, 1
    );

    DECLARE @idLaura INT = SCOPE_IDENTITY();

    INSERT INTO RespuestasSeguridad (IdUsuario, IdPregunta, RespuestaHash) VALUES
        (@idLaura, 1, '$2b$10$Cnl6lH36VFU6d3JySPiVquVNZI/FaQBeX6QnDCoK5CXoWZJu1IuJi'),
        (@idLaura, 2, '$2b$10$WfYZGbLnxbJxXxpA.CtStuJCxphZuqB/wb2Kc.hFYjV3K7e6fKJQ2'),
        (@idLaura, 3, '$2b$10$fb4OCh1Xb351Kjceg9M.AOaJ.DTE9qOVODbI63U3BNlZoN/Kh6VJe');

    INSERT INTO AuditoriaLogin (IdUsuario, CorreoIngresado, Resultado, Motivo, FechaIntento) VALUES
        (@idLaura, 'laura.jimenez@test.com', 'FALLIDO',   'Contraseña incorrecta',             DATEADD(MINUTE, -15, GETDATE())),
        (@idLaura, 'laura.jimenez@test.com', 'FALLIDO',   'Contraseña incorrecta',             DATEADD(MINUTE, -10, GETDATE())),
        (@idLaura, 'laura.jimenez@test.com', 'BLOQUEADO', 'Cuenta bloqueada tras 3 intentos',  DATEADD(MINUTE,  -5, GETDATE()));

    PRINT 'Laura Jiménez insertada BLOQUEADA (ID=' + CAST(@idLaura AS VARCHAR) + ')';
END
ELSE
    PRINT 'Laura Jiménez ya existe — omitida';
GO

-- ============================================================
-- 4. DIEGO SOLIS — Empleado activo
--    Contraseña: Planta_2023Abc!
-- ============================================================
DECLARE @idEmpleado4 INT = (SELECT TOP 1 IdRol FROM Roles WHERE NombreRol = 'Empleado');

IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE Correo = 'diego.solis@test.com')
BEGIN
    INSERT INTO Usuarios (
        IdRol, Nombre, Apellidos, Correo, Telefono, Direccion,
        Contrasena,
        NombreUsuario, ContrasenaHash,
        FechaCreacionContrasena, FechaExpiracionContrasena,
        IntentosFallidos, CuentaBloqueada, FechaBloqueo,
        CorreoVerificado, Estado
    ) VALUES (
        @idEmpleado4,
        'Diego', 'Solís Mora', 'diego.solis@test.com', '84324567', 'Alajuela, Costa Rica',
        'MIGRADO',
        'diegosolis04',
        '$2b$10$AsvhYMVc8YmY6JDELMf3e.AFjqa8yvX1FEIquZ2Lc8PIWh/qdK4T2',
        GETDATE(), DATEADD(DAY, 120, GETDATE()),
        0, 0, NULL,
        1, 1
    );

    DECLARE @idDiego INT = SCOPE_IDENTITY();

    INSERT INTO RespuestasSeguridad (IdUsuario, IdPregunta, RespuestaHash) VALUES
        (@idDiego, 1, '$2b$10$7QzwIeRPNx1uiXa78r4pEeVgWYBkuFg.Minb9Xfcbk3hvqk7Pmlb2'),
        (@idDiego, 2, '$2b$10$Oq4aJPkB9Z044wQy0s4dy.DPH2JRULwknbGL5B.weaMOU3XCMP5Y2'),
        (@idDiego, 3, '$2b$10$nT6IAyX7.a6W5y9/tXgIhukcsBah0vfGe0E16DN20XrPxPo4CvtKW');

    PRINT 'Diego Solís insertado (ID=' + CAST(@idDiego AS VARCHAR) + ')';
END
ELSE
    PRINT 'Diego Solís ya existe — omitido';
GO

-- ============================================================
-- 5. ACTUALIZAR USUARIOS ORIGINALES (legado)
--    Solo si ContrasenaHash está NULL (idempotente)
-- ============================================================

-- Carlos Ramírez (carlos@email.com)
IF EXISTS (SELECT 1 FROM Usuarios WHERE Correo = 'carlos@email.com' AND ContrasenaHash IS NULL)
BEGIN
    DECLARE @idCRam INT = (SELECT IdUsuario FROM Usuarios WHERE Correo = 'carlos@email.com');

    UPDATE Usuarios SET
        NombreUsuario             = 'carlosramirez',
        ContrasenaHash            = '$2b$10$lgyMk5/m4CVCVt14/54hU.LlOeh5b5tuHbFkcyN7NJLQ1Pv.n0GkC',
        FechaCreacionContrasena   = GETDATE(),
        FechaExpiracionContrasena = DATEADD(DAY, 120, GETDATE()),
        IntentosFallidos          = 0,
        CuentaBloqueada           = 0,
        FechaBloqueo              = NULL,
        CorreoVerificado          = 1
    WHERE Correo = 'carlos@email.com';

    IF NOT EXISTS (SELECT 1 FROM RespuestasSeguridad WHERE IdUsuario = @idCRam)
        INSERT INTO RespuestasSeguridad (IdUsuario, IdPregunta, RespuestaHash) VALUES
            (@idCRam, 1, '$2b$10$4jtYtz2ZV757owMGP.VEfe6frBzfl/QqskFEheEMU9Nk9a4Eoj1.2'),
            (@idCRam, 2, '$2b$10$hZh63wvNNiTaJgsJuHIq3e3xyNuhgVgkgCAtbNyFTNpIxWcTwItE.'),
            (@idCRam, 3, '$2b$10$mSskBCtBTRmy4o.CgqEFa.6Tws5kCnxrhAIxJjD1tkIFIKu.FMmc.');

    PRINT 'Carlos Ramírez actualizado → carlosramirez / Cafe@Bosque1';
END
ELSE
    PRINT 'Carlos Ramírez: ya tiene hash o no existe — omitido';
GO

-- María Fernández (maria@email.com)
IF EXISTS (SELECT 1 FROM Usuarios WHERE Correo = 'maria@email.com' AND ContrasenaHash IS NULL)
BEGIN
    DECLARE @idMFern INT = (SELECT IdUsuario FROM Usuarios WHERE Correo = 'maria@email.com');

    UPDATE Usuarios SET
        NombreUsuario             = 'mariafernandez',
        ContrasenaHash            = '$2b$10$YUjOeECuvAXxqzT3FQTAt.uj2xl.8E1BkxtgGPp9MyicYSB5k5hN2',
        FechaCreacionContrasena   = GETDATE(),
        FechaExpiracionContrasena = DATEADD(DAY, 120, GETDATE()),
        IntentosFallidos          = 0,
        CuentaBloqueada           = 0,
        FechaBloqueo              = NULL,
        CorreoVerificado          = 1
    WHERE Correo = 'maria@email.com';

    IF NOT EXISTS (SELECT 1 FROM RespuestasSeguridad WHERE IdUsuario = @idMFern)
        INSERT INTO RespuestasSeguridad (IdUsuario, IdPregunta, RespuestaHash) VALUES
            (@idMFern, 1, '$2b$10$4jtYtz2ZV757owMGP.VEfe6frBzfl/QqskFEheEMU9Nk9a4Eoj1.2'),
            (@idMFern, 2, '$2b$10$hZh63wvNNiTaJgsJuHIq3e3xyNuhgVgkgCAtbNyFTNpIxWcTwItE.'),
            (@idMFern, 3, '$2b$10$mSskBCtBTRmy4o.CgqEFa.6Tws5kCnxrhAIxJjD1tkIFIKu.FMmc.');

    PRINT 'María Fernández actualizada → mariafernandez / Vivero@Luna2';
END
ELSE
    PRINT 'María Fernández: ya tiene hash o no existe — omitida';
GO

-- Andrea Solano (andrea@raices.com)
IF EXISTS (SELECT 1 FROM Usuarios WHERE Correo = 'andrea@raices.com' AND ContrasenaHash IS NULL)
BEGIN
    DECLARE @idASol INT = (SELECT IdUsuario FROM Usuarios WHERE Correo = 'andrea@raices.com');

    UPDATE Usuarios SET
        NombreUsuario             = 'andreasolano',
        ContrasenaHash            = '$2b$10$u7ss.mVGR1iHAmnDrkMttuUU7dWHiTBJBA7rAHul9KJwm/yJCNLuq',
        FechaCreacionContrasena   = GETDATE(),
        FechaExpiracionContrasena = DATEADD(DAY, 120, GETDATE()),
        IntentosFallidos          = 0,
        CuentaBloqueada           = 0,
        FechaBloqueo              = NULL,
        CorreoVerificado          = 1
    WHERE Correo = 'andrea@raices.com';

    IF NOT EXISTS (SELECT 1 FROM RespuestasSeguridad WHERE IdUsuario = @idASol)
        INSERT INTO RespuestasSeguridad (IdUsuario, IdPregunta, RespuestaHash) VALUES
            (@idASol, 1, '$2b$10$4jtYtz2ZV757owMGP.VEfe6frBzfl/QqskFEheEMU9Nk9a4Eoj1.2'),
            (@idASol, 2, '$2b$10$hZh63wvNNiTaJgsJuHIq3e3xyNuhgVgkgCAtbNyFTNpIxWcTwItE.'),
            (@idASol, 3, '$2b$10$mSskBCtBTRmy4o.CgqEFa.6Tws5kCnxrhAIxJjD1tkIFIKu.FMmc.');

    PRINT 'Andrea Solano actualizada → andreasolano / Raices#Sol3';
END
ELSE
    PRINT 'Andrea Solano: ya tiene hash o no existe — omitida';
GO

-- Admin Principal (admin@raices.com)
IF EXISTS (SELECT 1 FROM Usuarios WHERE Correo = 'admin@raices.com' AND ContrasenaHash IS NULL)
BEGIN
    DECLARE @idAdmin INT = (SELECT IdUsuario FROM Usuarios WHERE Correo = 'admin@raices.com');

    UPDATE Usuarios SET
        NombreUsuario             = 'adminprincipal',
        ContrasenaHash            = '$2b$10$Kn/1PrBu6d9pkmxECX51J.tQpDuU3xGWXyxzmRqocKO6w5oA9Hvj.',
        FechaCreacionContrasena   = GETDATE(),
        FechaExpiracionContrasena = DATEADD(DAY, 120, GETDATE()),
        IntentosFallidos          = 0,
        CuentaBloqueada           = 0,
        FechaBloqueo              = NULL,
        CorreoVerificado          = 1
    WHERE Correo = 'admin@raices.com';

    IF NOT EXISTS (SELECT 1 FROM RespuestasSeguridad WHERE IdUsuario = @idAdmin)
        INSERT INTO RespuestasSeguridad (IdUsuario, IdPregunta, RespuestaHash) VALUES
            (@idAdmin, 1, '$2b$10$4jtYtz2ZV757owMGP.VEfe6frBzfl/QqskFEheEMU9Nk9a4Eoj1.2'),
            (@idAdmin, 2, '$2b$10$hZh63wvNNiTaJgsJuHIq3e3xyNuhgVgkgCAtbNyFTNpIxWcTwItE.'),
            (@idAdmin, 3, '$2b$10$mSskBCtBTRmy4o.CgqEFa.6Tws5kCnxrhAIxJjD1tkIFIKu.FMmc.');

    PRINT 'Admin Principal actualizado → adminprincipal / Admin@Raiz1!';
END
ELSE
    PRINT 'Admin Principal: ya tiene hash o no existe — omitido';
GO

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================
SELECT
    u.IdUsuario,
    u.Correo,
    u.NombreUsuario,
    CASE WHEN u.ContrasenaHash IS NOT NULL THEN 'Si' ELSE 'No' END          AS TieneHash,
    CASE WHEN u.CuentaBloqueada = 1        THEN 'BLOQUEADA' ELSE 'Activa'  END AS EstadoCuenta,
    CASE WHEN u.FechaExpiracionContrasena IS NULL THEN 'Sin fecha'
         WHEN u.FechaExpiracionContrasena < GETDATE() THEN 'VENCIDA'
         ELSE 'Vigente' END                                                  AS Contrasena,
    (SELECT COUNT(*) FROM RespuestasSeguridad rs
     WHERE rs.IdUsuario = u.IdUsuario)                                       AS Respuestas
FROM Usuarios u
ORDER BY u.IdUsuario;
GO

PRINT '======================================================';
PRINT 'Seed completado.';
PRINT '======================================================';
PRINT 'NUEVOS USUARIOS DE PRUEBA:';
PRINT '  ana.garcia@test.com    / anagarcia01    -> Bosque@2026      [normal]';
PRINT '  carlos.mora@test.com   / carlosmora02   -> Vivero#2025      [vencida]';
PRINT '  laura.jimenez@test.com / laurajimenez03 -> Jardin!2024      [bloqueada]';
PRINT '  diego.solis@test.com   / diegosolis04   -> Planta_2023Abc!  [empleado]';
PRINT '------------------------------------------------------';
PRINT 'USUARIOS ORIGINALES ACTUALIZADOS:';
PRINT '  carlos@email.com   / carlosramirez  -> Cafe@Bosque1';
PRINT '  maria@email.com    / mariafernandez -> Vivero@Luna2';
PRINT '  andrea@raices.com  / andreasolano   -> Raices#Sol3';
PRINT '  admin@raices.com   / adminprincipal -> Admin@Raiz1!';
PRINT '------------------------------------------------------';
PRINT 'RESPUESTAS LEGADO: "Rojo brillante" / "Marte definitivo" / "Casado con arroz"';
PRINT '======================================================';
GO
