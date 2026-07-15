-- ============================================================
-- 004_ubicaciones_geograficas_rollback.sql
-- Reversión de la migración 004_ubicaciones_geograficas.sql
-- ============================================================

USE tiusr15pl_RaicesCafeVivero;
GO

IF OBJECT_ID('UbicacionesGeograficas', 'U') IS NOT NULL
    DROP TABLE UbicacionesGeograficas;
GO
