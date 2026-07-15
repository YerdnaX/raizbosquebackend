-- ============================================================
-- 004_ubicaciones_geograficas.sql
-- Tabla jerárquica única para países y sus divisiones
-- administrativas (provincia/estado, cantón/distrito, etc.).
-- Idempotente: puede ejecutarse más de una vez sin error.
-- ============================================================

USE tiusr15pl_RaicesCafeVivero;
GO

-- Requerido por los índices únicos filtrados (UQ_UbicacionesGeograficas_*) más abajo.
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UbicacionesGeograficas')
BEGIN
    CREATE TABLE UbicacionesGeograficas (
        IdUbicacion      INT          IDENTITY(1,1) PRIMARY KEY,
        IdUbicacionPadre INT          NULL,          -- NULL únicamente en registros raíz (países)
        Nivel            INT          NOT NULL CHECK (Nivel BETWEEN 1 AND 4),
        Nombre           VARCHAR(150) NOT NULL,
        CONSTRAINT FK_UbicacionesGeograficas_Padre
            FOREIGN KEY (IdUbicacionPadre) REFERENCES UbicacionesGeograficas(IdUbicacion)
    );
END
GO

-- Un registro raíz (país) no puede tener padre; todo lo demás sí debe tenerlo.
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints WHERE name = 'CK_UbicacionesGeograficas_RaizSinPadre'
)
BEGIN
    ALTER TABLE UbicacionesGeograficas
        ADD CONSTRAINT CK_UbicacionesGeograficas_RaizSinPadre
        CHECK (
            (Nivel = 1 AND IdUbicacionPadre IS NULL) OR
            (Nivel > 1 AND IdUbicacionPadre IS NOT NULL)
        );
END
GO

-- Índices para las consultas por padre, por nivel y por la combinación de ambos.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UbicacionesGeograficas_Padre')
    CREATE INDEX IX_UbicacionesGeograficas_Padre ON UbicacionesGeograficas(IdUbicacionPadre);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UbicacionesGeograficas_Nivel')
    CREATE INDEX IX_UbicacionesGeograficas_Nivel ON UbicacionesGeograficas(Nivel);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UbicacionesGeograficas_Padre_Nivel')
    CREATE INDEX IX_UbicacionesGeograficas_Padre_Nivel ON UbicacionesGeograficas(IdUbicacionPadre, Nivel);
GO

-- Evita duplicados dentro de un mismo padre. SQL Server no permite más de un NULL
-- en un índice único normal, por lo que los países (IdUbicacionPadre NULL) usan un
-- índice filtrado independiente, igual que UQ_Usuarios_NombreUsuario en creadorDB.sql.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_UbicacionesGeograficas_Raiz')
    CREATE UNIQUE INDEX UQ_UbicacionesGeograficas_Raiz
        ON UbicacionesGeograficas(Nombre)
        WHERE IdUbicacionPadre IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_UbicacionesGeograficas_PadreNombre')
    CREATE UNIQUE INDEX UQ_UbicacionesGeograficas_PadreNombre
        ON UbicacionesGeograficas(IdUbicacionPadre, Nombre)
        WHERE IdUbicacionPadre IS NOT NULL;
GO
