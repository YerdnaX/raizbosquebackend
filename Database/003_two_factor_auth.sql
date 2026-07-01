-- =============================================================================
-- Migración 003: Autenticación en dos factores (2FA) con secreto cifrado
-- Ejecutar en la base de datos SQL Server ANTES de desplegar el nuevo backend.
-- =============================================================================

-- 1. Eliminar columnas anteriores del intento de 2FA (migración 002) si existen
--    Primero se eliminan los DEFAULT constraints (SQL Server no permite DROP COLUMN con constraints activos)

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Usuarios') AND name = N'TotpSecret')
BEGIN
    DECLARE @constraintTotp NVARCHAR(256);
    SELECT @constraintTotp = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    WHERE c.object_id = OBJECT_ID(N'Usuarios') AND c.name = N'TotpSecret';
    IF @constraintTotp IS NOT NULL
        EXEC('ALTER TABLE Usuarios DROP CONSTRAINT [' + @constraintTotp + ']');
    ALTER TABLE Usuarios DROP COLUMN TotpSecret;
END

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Usuarios') AND name = N'Totp2FAActivo')
BEGIN
    DECLARE @constraintActivo NVARCHAR(256);
    SELECT @constraintActivo = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    WHERE c.object_id = OBJECT_ID(N'Usuarios') AND c.name = N'Totp2FAActivo';
    IF @constraintActivo IS NOT NULL
        EXEC('ALTER TABLE Usuarios DROP CONSTRAINT [' + @constraintActivo + ']');
    ALTER TABLE Usuarios DROP COLUMN Totp2FAActivo;
END

-- 2. Agregar nuevas columnas 2FA
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Usuarios') AND name = N'TwoFactorEnabled')
    ALTER TABLE Usuarios ADD TwoFactorEnabled BIT NOT NULL DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Usuarios') AND name = N'TwoFactorMethod')
    ALTER TABLE Usuarios ADD TwoFactorMethod NVARCHAR(50) NULL;
    -- Valores posibles: 'GOOGLE_AUTHENTICATOR' | 'PERSONAL_AUTHENTICATOR' | NULL

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Usuarios') AND name = N'TwoFactorSecretEncrypted')
    ALTER TABLE Usuarios ADD TwoFactorSecretEncrypted NVARCHAR(700) NULL;
    -- Formato: iv_hex:tag_hex:ciphertext_hex  (AES-256-GCM)

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Usuarios') AND name = N'TwoFactorDeviceLinkedAt')
    ALTER TABLE Usuarios ADD TwoFactorDeviceLinkedAt DATETIME NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Usuarios') AND name = N'TwoFactorCreatedAt')
    ALTER TABLE Usuarios ADD TwoFactorCreatedAt DATETIME NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'Usuarios') AND name = N'TwoFactorUpdatedAt')
    ALTER TABLE Usuarios ADD TwoFactorUpdatedAt DATETIME NULL;
