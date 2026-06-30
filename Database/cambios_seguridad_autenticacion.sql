-- ============================================================
-- cambios_seguridad_autenticacion.sql
-- Actualiza una base de datos EXISTENTE sin destruir datos.
-- Aplica todos los cambios requeridos por las HU de seguridad.
-- Orden: 1) Columnas en Usuarios, 2) Tablas nuevas, 3) Índices, 4) Datos semilla.
-- ============================================================

USE tiusr15pl_RaicesCafeVivero;
GO

-- ------------------------------------------------------------
-- 1. COLUMNAS NUEVAS EN Usuarios
-- ------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios' AND COLUMN_NAME='NombreUsuario')
    ALTER TABLE Usuarios ADD NombreUsuario VARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios' AND COLUMN_NAME='ContrasenaHash')
    ALTER TABLE Usuarios ADD ContrasenaHash VARCHAR(255) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios' AND COLUMN_NAME='FechaCreacionContrasena')
    ALTER TABLE Usuarios ADD FechaCreacionContrasena DATETIME NULL;
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios' AND COLUMN_NAME='FechaExpiracionContrasena')
    ALTER TABLE Usuarios ADD FechaExpiracionContrasena DATETIME NULL;
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios' AND COLUMN_NAME='IntentosFallidos')
    ALTER TABLE Usuarios ADD IntentosFallidos INT DEFAULT 0;
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios' AND COLUMN_NAME='CuentaBloqueada')
    ALTER TABLE Usuarios ADD CuentaBloqueada BIT DEFAULT 0;
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios' AND COLUMN_NAME='FechaBloqueo')
    ALTER TABLE Usuarios ADD FechaBloqueo DATETIME NULL;
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Usuarios' AND COLUMN_NAME='CorreoVerificado')
    ALTER TABLE Usuarios ADD CorreoVerificado BIT DEFAULT 0;
GO

-- Marcar usuarios existentes como verificados (ya estaban en el sistema)
UPDATE Usuarios
SET CorreoVerificado = 1,
    IntentosFallidos = 0,
    CuentaBloqueada  = 0
WHERE CorreoVerificado IS NULL OR CorreoVerificado = 0;
GO

-- Índice único en NombreUsuario (case-insensitive gracias a la collation del servidor)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Usuarios_NombreUsuario')
    CREATE UNIQUE INDEX UQ_Usuarios_NombreUsuario
        ON Usuarios(NombreUsuario)
        WHERE NombreUsuario IS NOT NULL;
GO

-- ------------------------------------------------------------
-- 2. PREGUNTAS DE SEGURIDAD
-- ------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PreguntasSeguridad')
BEGIN
    CREATE TABLE PreguntasSeguridad (
        IdPregunta    INT          IDENTITY(1,1) PRIMARY KEY,
        TextoPregunta VARCHAR(300) NOT NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM PreguntasSeguridad WHERE TextoPregunta = '¿Qué color tendría su dragón?')
BEGIN
    SET IDENTITY_INSERT PreguntasSeguridad ON;
    INSERT INTO PreguntasSeguridad (IdPregunta, TextoPregunta) VALUES
        (1, '¿Qué color tendría su dragón?'),
        (2, '¿Qué planeta visitaría primero?'),
        (3, '¿Qué comida defendería en una discusión absurda?');
    SET IDENTITY_INSERT PreguntasSeguridad OFF;
END;
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RespuestasSeguridad')
BEGIN
    CREATE TABLE RespuestasSeguridad (
        IdRespuesta   INT          IDENTITY(1,1) PRIMARY KEY,
        IdUsuario     INT          NOT NULL,
        IdPregunta    INT          NOT NULL,
        RespuestaHash VARCHAR(255) NOT NULL,
        FOREIGN KEY (IdUsuario)  REFERENCES Usuarios(IdUsuario),
        FOREIGN KEY (IdPregunta) REFERENCES PreguntasSeguridad(IdPregunta)
    );
END;
GO

-- ------------------------------------------------------------
-- 3. CÓDIGOS DE VERIFICACIÓN
-- ------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'CodigosVerificacion')
BEGIN
    CREATE TABLE CodigosVerificacion (
        IdCodigo        INT          IDENTITY(1,1) PRIMARY KEY,
        Correo          VARCHAR(150) NOT NULL,
        CodigoHash      VARCHAR(255) NOT NULL,
        Tipo            VARCHAR(50)  NOT NULL,    -- 'REGISTRO' | 'RECUPERACION'
        FechaExpiracion DATETIME     NOT NULL,
        Usado           BIT          DEFAULT 0,
        FechaCreacion   DATETIME     DEFAULT GETDATE()
    );
END;
GO

CREATE INDEX IX_CodigosVerificacion_Correo ON CodigosVerificacion(Correo, Tipo, Usado);
GO

-- ------------------------------------------------------------
-- 4. TOKENS TEMPORALES
-- ------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TokensTemporal')
BEGIN
    CREATE TABLE TokensTemporal (
        IdToken         INT          IDENTITY(1,1) PRIMARY KEY,
        Correo          VARCHAR(150) NOT NULL,
        TokenHash       VARCHAR(255) NOT NULL,
        Tipo            VARCHAR(50)  NOT NULL,
        FechaExpiracion DATETIME     NOT NULL,
        Usado           BIT          DEFAULT 0,
        FechaCreacion   DATETIME     DEFAULT GETDATE()
    );
END;
GO

CREATE INDEX IX_TokensTemporal_Correo ON TokensTemporal(Correo, Tipo, Usado);
GO

-- ------------------------------------------------------------
-- 5. AUDITORÍA DE INICIO DE SESIÓN
-- ------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditoriaLogin')
BEGIN
    CREATE TABLE AuditoriaLogin (
        IdAuditoria     INT          IDENTITY(1,1) PRIMARY KEY,
        IdUsuario       INT          NULL,
        CorreoIngresado VARCHAR(150) NULL,
        Resultado       VARCHAR(50)  NOT NULL,
        Motivo          VARCHAR(200) NULL,
        DireccionIP     VARCHAR(45)  NULL,
        UserAgent       VARCHAR(500) NULL,
        FechaIntento    DATETIME     DEFAULT GETDATE(),
        FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
    );
END;
GO

CREATE INDEX IX_AuditoriaLogin_Fecha ON AuditoriaLogin(FechaIntento);
GO

-- ------------------------------------------------------------
-- 6. AUDITORÍA DE CAMBIO DE CONTRASEÑA
-- ------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditoriaContrasena')
BEGIN
    CREATE TABLE AuditoriaContrasena (
        IdAuditoria            INT          IDENTITY(1,1) PRIMARY KEY,
        IdUsuario              INT          NOT NULL,
        FechaCambio            DATETIME     DEFAULT GETDATE(),
        FechaExpiracionNueva   DATETIME     NULL,
        EstadoBloqueoPrevio    BIT          NULL,
        EstadoBloqueoPosterior BIT          NULL,
        Motivo                 VARCHAR(100) NULL,
        FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
    );
END;
GO
