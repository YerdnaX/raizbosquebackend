IF COL_LENGTH('Compras', 'CodigoCupon') IS NULL
BEGIN
    ALTER TABLE Compras
    ADD CodigoCupon VARCHAR(50) NULL;
END;
GO

IF COL_LENGTH('Compras', 'Descuento') IS NULL
BEGIN
    ALTER TABLE Compras
    ADD Descuento DECIMAL(10,2) NOT NULL
        CONSTRAINT DF_Compras_Descuento DEFAULT 0;
END;
GO
