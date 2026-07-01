-- Migración: Soporte para verificación en dos pasos (TOTP / Google Authenticator)
-- Ejecutar en la base de datos antes de desplegar los nuevos endpoints de 2FA.

ALTER TABLE Usuarios
    ADD TotpSecret    NVARCHAR(255) NULL,
        Totp2FAActivo BIT           NOT NULL DEFAULT 0;
