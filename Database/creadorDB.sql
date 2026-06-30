-- ============================================================
-- creadorDB.sql
-- Base de datos completa: Raíces Café & Vivero
-- Incluye: esquema, datos semilla, categorías vivero, productos,
--          preguntas de seguridad y nuevas tablas de autenticación.
-- Idempotente para categorías y productos del vivero.
-- Reemplaza: corregir_categorias_vivero.sql e insertar_productos_vivero.sql
-- ============================================================

USE tiusr15pl_RaicesCafeVivero;
GO

-- ------------------------------------------------------------
-- TABLAS BASE
-- ------------------------------------------------------------

CREATE TABLE Roles (
    IdRol INT IDENTITY(1,1) PRIMARY KEY,
    NombreRol VARCHAR(50) NOT NULL
);

CREATE TABLE Usuarios (
    IdUsuario               INT           IDENTITY(1,1) PRIMARY KEY,
    IdRol                   INT           NOT NULL,
    Nombre                  VARCHAR(100)  NOT NULL,
    Apellidos               VARCHAR(150)  NOT NULL,
    Correo                  VARCHAR(150)  NOT NULL UNIQUE,
    Telefono                VARCHAR(20),
    Direccion               VARCHAR(300),
    Contrasena              VARCHAR(255)  NULL,          -- columna legado (migración)
    NombreUsuario           VARCHAR(100)  NULL,
    ContrasenaHash          VARCHAR(255)  NULL,          -- bcrypt hash
    FechaCreacionContrasena DATETIME      NULL,
    FechaExpiracionContrasena DATETIME    NULL,          -- creación + 120 días
    IntentosFallidos        INT           DEFAULT 0,
    CuentaBloqueada         BIT           DEFAULT 0,
    FechaBloqueo            DATETIME      NULL,
    CorreoVerificado        BIT           DEFAULT 0,
    Estado                  BIT           DEFAULT 1,
    FechaRegistro           DATETIME      DEFAULT GETDATE(),
    FOREIGN KEY (IdRol) REFERENCES Roles(IdRol)
);
GO
CREATE UNIQUE INDEX UQ_Usuarios_NombreUsuario
    ON Usuarios(NombreUsuario)
    WHERE NombreUsuario IS NOT NULL;
GO

-- ------------------------------------------------------------
-- PREGUNTAS DE SEGURIDAD (fijas, pre-sembradas)
-- ------------------------------------------------------------

CREATE TABLE PreguntasSeguridad (
    IdPregunta     INT          IDENTITY(1,1) PRIMARY KEY,
    TextoPregunta  VARCHAR(300) NOT NULL
);

CREATE TABLE RespuestasSeguridad (
    IdRespuesta   INT          IDENTITY(1,1) PRIMARY KEY,
    IdUsuario     INT          NOT NULL,
    IdPregunta    INT          NOT NULL,
    RespuestaHash VARCHAR(255) NOT NULL,
    FOREIGN KEY (IdUsuario)  REFERENCES Usuarios(IdUsuario),
    FOREIGN KEY (IdPregunta) REFERENCES PreguntasSeguridad(IdPregunta)
);

-- ------------------------------------------------------------
-- CÓDIGOS DE VERIFICACIÓN (registro y recuperación)
-- ------------------------------------------------------------

CREATE TABLE CodigosVerificacion (
    IdCodigo        INT          IDENTITY(1,1) PRIMARY KEY,
    Correo          VARCHAR(150) NOT NULL,
    CodigoHash      VARCHAR(255) NOT NULL,
    Tipo            VARCHAR(50)  NOT NULL,     -- 'REGISTRO' | 'RECUPERACION'
    FechaExpiracion DATETIME     NOT NULL,
    Usado           BIT          DEFAULT 0,
    FechaCreacion   DATETIME     DEFAULT GETDATE()
);

-- ------------------------------------------------------------
-- TOKENS TEMPORALES (post-verificación, pre-registro/recuperación)
-- ------------------------------------------------------------

CREATE TABLE TokensTemporal (
    IdToken         INT          IDENTITY(1,1) PRIMARY KEY,
    Correo          VARCHAR(150) NOT NULL,
    TokenHash       VARCHAR(255) NOT NULL,
    Tipo            VARCHAR(50)  NOT NULL,   -- 'REGISTRO' | 'RECUPERACION_CORREO' | 'RECUPERACION_PREGUNTAS'
    FechaExpiracion DATETIME     NOT NULL,
    Usado           BIT          DEFAULT 0,
    FechaCreacion   DATETIME     DEFAULT GETDATE()
);

-- ------------------------------------------------------------
-- AUDITORÍA DE INICIO DE SESIÓN
-- ------------------------------------------------------------

CREATE TABLE AuditoriaLogin (
    IdAuditoria      INT          IDENTITY(1,1) PRIMARY KEY,
    IdUsuario        INT          NULL,
    CorreoIngresado  VARCHAR(150) NULL,
    Resultado        VARCHAR(50)  NOT NULL,  -- 'EXITOSO'|'FALLIDO'|'BLOQUEADO'|'INTENTO_BLOQUEADA'
    Motivo           VARCHAR(200) NULL,
    DireccionIP      VARCHAR(45)  NULL,
    UserAgent        VARCHAR(500) NULL,
    FechaIntento     DATETIME     DEFAULT GETDATE(),
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

-- ------------------------------------------------------------
-- AUDITORÍA DE CAMBIO DE CONTRASEÑA
-- ------------------------------------------------------------

CREATE TABLE AuditoriaContrasena (
    IdAuditoria           INT          IDENTITY(1,1) PRIMARY KEY,
    IdUsuario             INT          NOT NULL,
    FechaCambio           DATETIME     DEFAULT GETDATE(),
    FechaExpiracionNueva  DATETIME     NULL,
    EstadoBloqueoPrevio   BIT          NULL,
    EstadoBloqueoPosterior BIT         NULL,
    Motivo                VARCHAR(100) NULL,  -- 'REGISTRO'|'RECUPERACION_CORREO'|'RECUPERACION_PREGUNTAS'|'VENCIDA'|'MANUAL'
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

-- ------------------------------------------------------------
-- CATÁLOGO
-- ------------------------------------------------------------

CREATE TABLE Categorias (
    IdCategoria     INT          IDENTITY(1,1) PRIMARY KEY,
    NombreCategoria VARCHAR(100) NOT NULL,
    Tipo            VARCHAR(50)  NOT NULL
);

CREATE TABLE Productos (
    IdProducto   INT           IDENTITY(1,1) PRIMARY KEY,
    IdCategoria  INT           NOT NULL,
    Nombre       VARCHAR(150)  NOT NULL,
    Descripcion  VARCHAR(500),
    Precio       DECIMAL(10,2) NOT NULL,
    Imagen       VARCHAR(300),
    TipoProducto VARCHAR(50)   NOT NULL,
    Disponible   BIT           DEFAULT 1,
    Stock        INT           DEFAULT 0,
    FechaRegistro DATETIME     DEFAULT GETDATE(),
    FOREIGN KEY (IdCategoria) REFERENCES Categorias(IdCategoria)
);

CREATE TABLE Plantas (
    IdPlanta              INT          IDENTITY(1,1) PRIMARY KEY,
    IdProducto            INT          NOT NULL UNIQUE,
    TipoClima             VARCHAR(100),
    TemperaturaRecomendada VARCHAR(100),
    FrecuenciaRiego       VARCHAR(100),
    NivelLuz              VARCHAR(100),
    TipoSuelo             VARCHAR(100),
    CuidadosEspeciales    VARCHAR(500),
    TamanoAproximado      VARCHAR(100),
    NivelDificultad       VARCHAR(50),
    TieneQR               BIT          DEFAULT 0,
    CodigoQR              VARCHAR(100),
    FOREIGN KEY (IdProducto) REFERENCES Productos(IdProducto)
);

CREATE TABLE PreguntasRecomendador (
    IdPregunta INT          IDENTITY(1,1) PRIMARY KEY,
    Pregunta   VARCHAR(300) NOT NULL,
    Estado     BIT          DEFAULT 1
);

CREATE TABLE OpcionesRecomendador (
    IdOpcion    INT          IDENTITY(1,1) PRIMARY KEY,
    IdPregunta  INT          NOT NULL,
    TextoOpcion VARCHAR(200) NOT NULL,
    Valor       VARCHAR(100) NOT NULL,
    FOREIGN KEY (IdPregunta) REFERENCES PreguntasRecomendador(IdPregunta)
);

CREATE TABLE RecomendacionesPlantas (
    IdRecomendacion  INT          IDENTITY(1,1) PRIMARY KEY,
    IdPlanta         INT          NOT NULL,
    InteriorExterior VARCHAR(50),
    NivelLuz         VARCHAR(100),
    TieneMascotas    BIT,
    TiempoCuidado    VARCHAR(100),
    TipoClima        VARCHAR(100),
    FOREIGN KEY (IdPlanta) REFERENCES Plantas(IdPlanta)
);

CREATE TABLE Carritos (
    IdCarrito    INT          IDENTITY(1,1) PRIMARY KEY,
    IdUsuario    INT          NOT NULL,
    Estado       VARCHAR(50)  DEFAULT 'Activo',
    FechaCreacion DATETIME    DEFAULT GETDATE(),
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

CREATE TABLE CarritoDetalle (
    IdDetalle      INT           IDENTITY(1,1) PRIMARY KEY,
    IdCarrito      INT           NOT NULL,
    IdProducto     INT           NOT NULL,
    Cantidad       INT           NOT NULL,
    PrecioUnitario DECIMAL(10,2) NOT NULL,
    Subtotal       AS (Cantidad * PrecioUnitario),
    FOREIGN KEY (IdCarrito)  REFERENCES Carritos(IdCarrito),
    FOREIGN KEY (IdProducto) REFERENCES Productos(IdProducto)
);

CREATE TABLE Compras (
    IdCompra        INT           IDENTITY(1,1) PRIMARY KEY,
    IdUsuario       INT           NOT NULL,
    FechaCompra     DATETIME      DEFAULT GETDATE(),
    Subtotal        DECIMAL(10,2) NOT NULL,
    Impuesto        DECIMAL(10,2) NOT NULL,
    Total           DECIMAL(10,2) NOT NULL,
    MetodoEntrega   VARCHAR(50)   NOT NULL,
    DireccionEntrega VARCHAR(300),
    EstadoCompra    VARCHAR(50)   DEFAULT 'Pendiente',
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

CREATE TABLE CompraDetalle (
    IdCompraDetalle INT           IDENTITY(1,1) PRIMARY KEY,
    IdCompra        INT           NOT NULL,
    IdProducto      INT           NOT NULL,
    Cantidad        INT           NOT NULL,
    PrecioUnitario  DECIMAL(10,2) NOT NULL,
    Subtotal        DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (IdCompra)   REFERENCES Compras(IdCompra),
    FOREIGN KEY (IdProducto) REFERENCES Productos(IdProducto)
);

CREATE TABLE Reservaciones (
    IdReservacion    INT          IDENTITY(1,1) PRIMARY KEY,
    IdUsuario        INT          NOT NULL,
    FechaReservacion DATE         NOT NULL,
    HoraReservacion  TIME         NOT NULL,
    CantidadPersonas INT          NOT NULL,
    Estado           VARCHAR(50)  DEFAULT 'Pendiente',
    Comentarios      VARCHAR(300),
    FechaRegistro    DATETIME     DEFAULT GETDATE(),
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

CREATE TABLE JardinVirtual (
    IdJardin            INT          IDENTITY(1,1) PRIMARY KEY,
    IdUsuario           INT          NOT NULL,
    IdPlanta            INT          NOT NULL,
    NombrePersonalizado VARCHAR(100),
    FechaAdquisicion    DATE         DEFAULT GETDATE(),
    EstadoPlanta        VARCHAR(50)  DEFAULT 'Saludable',
    Notas               VARCHAR(500),
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario),
    FOREIGN KEY (IdPlanta)  REFERENCES Plantas(IdPlanta)
);

CREATE TABLE CuidadosPlantas (
    IdCuidado       INT          IDENTITY(1,1) PRIMARY KEY,
    IdJardin        INT          NOT NULL,
    TipoCuidado     VARCHAR(100) NOT NULL,
    FechaProgramada DATE         NOT NULL,
    Realizado       BIT          DEFAULT 0,
    FechaRealizado  DATETIME,
    Observacion     VARCHAR(300),
    FOREIGN KEY (IdJardin) REFERENCES JardinVirtual(IdJardin)
);

CREATE TABLE Notificaciones (
    IdNotificacion INT          IDENTITY(1,1) PRIMARY KEY,
    IdUsuario      INT          NOT NULL,
    Titulo         VARCHAR(150) NOT NULL,
    Mensaje        VARCHAR(500) NOT NULL,
    Tipo           VARCHAR(50),
    Leida          BIT          DEFAULT 0,
    Fecha          DATETIME     DEFAULT GETDATE(),
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

CREATE TABLE Promociones (
    IdPromocion  INT          IDENTITY(1,1) PRIMARY KEY,
    Titulo       VARCHAR(150) NOT NULL,
    Descripcion  VARCHAR(500),
    FechaInicio  DATE         NOT NULL,
    FechaFin     DATE         NOT NULL,
    Estado       BIT          DEFAULT 1
);

CREATE TABLE Calificaciones (
    IdCalificacion INT      IDENTITY(1,1) PRIMARY KEY,
    IdUsuario      INT      NOT NULL,
    IdProducto     INT      NOT NULL,
    Puntuacion     INT      CHECK (Puntuacion BETWEEN 1 AND 5),
    Fecha          DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (IdUsuario)  REFERENCES Usuarios(IdUsuario),
    FOREIGN KEY (IdProducto) REFERENCES Productos(IdProducto)
);

CREATE TABLE Comentarios (
    IdComentario INT          IDENTITY(1,1) PRIMARY KEY,
    IdUsuario    INT          NOT NULL,
    IdProducto   INT          NOT NULL,
    Comentario   VARCHAR(500) NOT NULL,
    Estado       BIT          DEFAULT 1,
    Fecha        DATETIME     DEFAULT GETDATE(),
    FOREIGN KEY (IdUsuario)  REFERENCES Usuarios(IdUsuario),
    FOREIGN KEY (IdProducto) REFERENCES Productos(IdProducto)
);

CREATE TABLE Auditoria (
    IdAuditoria   INT          IDENTITY(1,1) PRIMARY KEY,
    IdUsuario     INT          NULL,
    Accion        VARCHAR(200) NOT NULL,
    TablaAfectada VARCHAR(100),
    Fecha         DATETIME     DEFAULT GETDATE(),
    Detalle       VARCHAR(500),
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);
GO

-- ============================================================
-- DATOS SEMILLA
-- ============================================================

-- Roles
INSERT INTO Roles (NombreRol) VALUES
    ('Cliente'),
    ('Empleado'),
    ('Administrador');

-- Preguntas de seguridad fijas
SET IDENTITY_INSERT PreguntasSeguridad ON;
INSERT INTO PreguntasSeguridad (IdPregunta, TextoPregunta) VALUES
    (1, '¿Qué color tendría su dragón?'),
    (2, '¿Qué planeta visitaría primero?'),
    (3, '¿Qué comida defendería en una discusión absurda?');
SET IDENTITY_INSERT PreguntasSeguridad OFF;
GO

-- Usuarios de prueba (CorreoVerificado=1, Estado=1; deben cambiar contraseña en primer uso)
INSERT INTO Usuarios (IdRol, Nombre, Apellidos, Correo, Telefono, Direccion, Contrasena, CorreoVerificado, Estado)
VALUES
    (1, 'Carlos',  'Ramírez Soto',      'carlos@email.com',  '8888-1111', 'Cartago, Costa Rica',       '123456',   1, 1),
    (1, 'María',   'Fernández Mora',    'maria@email.com',   '8888-2222', 'San José, Costa Rica',      '123456',   1, 1),
    (2, 'Andrea',  'Solano Vega',       'andrea@raices.com', '8888-3333', 'Cartago Centro',            '123456',   1, 1),
    (3, 'Admin',   'Principal',         'admin@raices.com',  '8888-9999', 'Raíces Café & Vivero',      'admin123', 1, 1);

-- Categorías (idempotente)
IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Café Caliente')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Café Caliente', 'Restaurante');
IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Bebidas Frías')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Bebidas Frías', 'Restaurante');
IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Comidas')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Comidas', 'Restaurante');
IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Postres')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Postres', 'Restaurante');
IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Plantas de Interior')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Plantas de Interior', 'Vivero');
IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Plantas de Exterior')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Plantas de Exterior', 'Vivero');
IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Macetas')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Macetas', 'Vivero');
ELSE
    UPDATE Categorias SET Tipo = 'Vivero' WHERE NombreCategoria = 'Macetas';
IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Fertilizantes')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Fertilizantes', 'Vivero');
ELSE
    UPDATE Categorias SET Tipo = 'Vivero' WHERE NombreCategoria = 'Fertilizantes';
IF NOT EXISTS (SELECT 1 FROM Categorias WHERE NombreCategoria = 'Herramientas')
    INSERT INTO Categorias (NombreCategoria, Tipo) VALUES ('Herramientas', 'Vivero');
ELSE
    UPDATE Categorias SET Tipo = 'Vivero' WHERE NombreCategoria = 'Herramientas';
GO

-- Productos restaurante (idempotente)
IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Café Latte')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Café Latte', 'Café espresso con leche vaporizada.', 2200, 'latte.jpg', 'Restaurante', 1, 50
    FROM Categorias WHERE NombreCategoria = 'Café Caliente';

IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Capuchino')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Capuchino', 'Café espresso con espuma de leche.', 2300, 'capuchino.jpg', 'Restaurante', 1, 45
    FROM Categorias WHERE NombreCategoria = 'Café Caliente';

IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Té frío de frutos rojos')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Té frío de frutos rojos', 'Bebida fría natural con frutos rojos.', 1800, 'te_frio.jpg', 'Restaurante', 1, 40
    FROM Categorias WHERE NombreCategoria = 'Bebidas Frías';

IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Sándwich de pollo')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Sándwich de pollo', 'Sándwich artesanal con pollo y vegetales.', 3500, 'sandwich_pollo.jpg', 'Restaurante', 1, 30
    FROM Categorias WHERE NombreCategoria = 'Comidas';

IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Queque de zanahoria')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Queque de zanahoria', 'Postre artesanal con zanahoria y nueces.', 2000, 'queque_zanahoria.jpg', 'Restaurante', 1, 25
    FROM Categorias WHERE NombreCategoria = 'Postres';

-- Plantas (idempotente)
IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Monstera Deliciosa')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Monstera Deliciosa', 'Planta tropical de interior con hojas grandes.', 8500, 'monstera.jpg', 'Planta', 1, 15
    FROM Categorias WHERE NombreCategoria = 'Plantas de Interior';

IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Sansevieria')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Sansevieria', 'Planta resistente ideal para interiores.', 6500, 'sansevieria.jpg', 'Planta', 1, 20
    FROM Categorias WHERE NombreCategoria = 'Plantas de Interior';

IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Pothos Dorado')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Pothos Dorado', 'Planta colgante de fácil cuidado.', 4500, 'pothos.jpg', 'Planta', 1, 25
    FROM Categorias WHERE NombreCategoria = 'Plantas de Interior';

IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Lavanda')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Lavanda', 'Planta aromática para exteriores soleados.', 3800, 'lavanda.jpg', 'Planta', 1, 18
    FROM Categorias WHERE NombreCategoria = 'Plantas de Exterior';

IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Jazmín Estrella')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Jazmín Estrella', 'Planta ornamental trepadora con flores aromáticas.', 5200, 'jazmin.jpg', 'Planta', 1, 12
    FROM Categorias WHERE NombreCategoria = 'Plantas de Exterior';

-- Productos vivero (macetas, fertilizantes, herramientas) — idempotente
IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Maceta de barro mediana')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Maceta de barro mediana', 'Maceta artesanal de barro.', 3200, 'maceta_barro.jpg', 'ProductoVivero', 1, 35
    FROM Categorias WHERE NombreCategoria = 'Macetas';

IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Maceta decorativa blanca')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Maceta decorativa blanca', 'Maceta moderna para interiores.', 4500, 'maceta_blanca.jpg', 'ProductoVivero', 1, 20
    FROM Categorias WHERE NombreCategoria = 'Macetas';

IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Fertilizante orgánico')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Fertilizante orgánico', 'Fertilizante natural para plantas ornamentales.', 2800, 'fertilizante.jpg', 'ProductoVivero', 1, 40
    FROM Categorias WHERE NombreCategoria = 'Fertilizantes';

IF NOT EXISTS (SELECT 1 FROM Productos WHERE Nombre = 'Kit de jardinería básico')
    INSERT INTO Productos (IdCategoria, Nombre, Descripcion, Precio, Imagen, TipoProducto, Disponible, Stock)
    SELECT IdCategoria, 'Kit de jardinería básico', 'Herramientas básicas para cuidado de plantas.', 9500, 'kit_jardineria.jpg', 'ProductoVivero', 1, 10
    FROM Categorias WHERE NombreCategoria = 'Herramientas';

-- Garantizar que macetas/fertilizantes/herramientas apunten a categorías correctas
UPDATE p SET p.IdCategoria = c.IdCategoria
FROM Productos p
INNER JOIN Categorias c ON c.NombreCategoria = 'Macetas'
WHERE p.Nombre IN ('Maceta de barro mediana', 'Maceta decorativa blanca');

UPDATE p SET p.IdCategoria = c.IdCategoria
FROM Productos p
INNER JOIN Categorias c ON c.NombreCategoria = 'Fertilizantes'
WHERE p.Nombre = 'Fertilizante orgánico';

UPDATE p SET p.IdCategoria = c.IdCategoria
FROM Productos p
INNER JOIN Categorias c ON c.NombreCategoria = 'Herramientas'
WHERE p.Nombre = 'Kit de jardinería básico';
GO

-- Registros de plantas (idempotente por IdProducto único)
INSERT INTO Plantas (IdProducto, TipoClima, TemperaturaRecomendada, FrecuenciaRiego, NivelLuz, TipoSuelo, CuidadosEspeciales, TamanoAproximado, NivelDificultad, TieneQR, CodigoQR)
SELECT p.IdProducto, 'Tropical húmedo', '18°C - 28°C', '2 veces por semana', 'Luz indirecta brillante', 'Suelo fértil y drenado', 'Evitar sol directo fuerte.', 'Mediana a grande', 'Media', 1, 'QR-MONSTERA-001'
FROM Productos p WHERE p.Nombre = 'Monstera Deliciosa' AND NOT EXISTS (SELECT 1 FROM Plantas pl WHERE pl.IdProducto = p.IdProducto);

INSERT INTO Plantas (IdProducto, TipoClima, TemperaturaRecomendada, FrecuenciaRiego, NivelLuz, TipoSuelo, CuidadosEspeciales, TamanoAproximado, NivelDificultad, TieneQR, CodigoQR)
SELECT p.IdProducto, 'Cálido seco', '16°C - 30°C', 'Cada 10 a 15 días', 'Luz indirecta o semisombra', 'Suelo bien drenado', 'No exceder el riego.', 'Mediana', 'Fácil', 1, 'QR-SANSEVIERIA-002'
FROM Productos p WHERE p.Nombre = 'Sansevieria' AND NOT EXISTS (SELECT 1 FROM Plantas pl WHERE pl.IdProducto = p.IdProducto);

INSERT INTO Plantas (IdProducto, TipoClima, TemperaturaRecomendada, FrecuenciaRiego, NivelLuz, TipoSuelo, CuidadosEspeciales, TamanoAproximado, NivelDificultad, TieneQR, CodigoQR)
SELECT p.IdProducto, 'Tropical', '18°C - 30°C', '1 o 2 veces por semana', 'Luz indirecta', 'Suelo liviano', 'Puede crecer en agua.', 'Pequeña a mediana', 'Fácil', 1, 'QR-POTHOS-003'
FROM Productos p WHERE p.Nombre = 'Pothos Dorado' AND NOT EXISTS (SELECT 1 FROM Plantas pl WHERE pl.IdProducto = p.IdProducto);

INSERT INTO Plantas (IdProducto, TipoClima, TemperaturaRecomendada, FrecuenciaRiego, NivelLuz, TipoSuelo, CuidadosEspeciales, TamanoAproximado, NivelDificultad, TieneQR, CodigoQR)
SELECT p.IdProducto, 'Templado seco', '15°C - 27°C', 'Cada 3 a 4 días', 'Sol directo', 'Suelo arenoso', 'Podar flores secas.', 'Pequeña', 'Media', 1, 'QR-LAVANDA-004'
FROM Productos p WHERE p.Nombre = 'Lavanda' AND NOT EXISTS (SELECT 1 FROM Plantas pl WHERE pl.IdProducto = p.IdProducto);

INSERT INTO Plantas (IdProducto, TipoClima, TemperaturaRecomendada, FrecuenciaRiego, NivelLuz, TipoSuelo, CuidadosEspeciales, TamanoAproximado, NivelDificultad, TieneQR, CodigoQR)
SELECT p.IdProducto, 'Templado tropical', '16°C - 28°C', '2 veces por semana', 'Sol parcial', 'Suelo fértil', 'Necesita soporte para trepar.', 'Grande', 'Media', 1, 'QR-JAZMIN-005'
FROM Productos p WHERE p.Nombre = 'Jazmín Estrella' AND NOT EXISTS (SELECT 1 FROM Plantas pl WHERE pl.IdProducto = p.IdProducto);
GO

-- Preguntas y opciones del recomendador
INSERT INTO PreguntasRecomendador (Pregunta) VALUES
    ('¿Desea una planta para interior o exterior?'),
    ('¿Cuánta luz recibe el lugar?'),
    ('¿Tiene mascotas en casa?'),
    ('¿Cuánto tiempo puede dedicar al cuidado?'),
    ('¿Qué tipo de clima tiene el espacio?');

INSERT INTO OpcionesRecomendador (IdPregunta, TextoOpcion, Valor) VALUES
    (1, 'Interior', 'Interior'),   (1, 'Exterior', 'Exterior'),
    (2, 'Poca luz', 'Poca'),       (2, 'Luz indirecta', 'Indirecta'), (2, 'Sol directo', 'Directa'),
    (3, 'Sí, tengo mascotas', 'Si'),(3, 'No tengo mascotas', 'No'),
    (4, 'Poco tiempo', 'Bajo'),    (4, 'Tiempo moderado', 'Medio'),   (4, 'Mucho tiempo', 'Alto'),
    (5, 'Tropical húmedo', 'TropicalHumedo'),(5, 'Cálido seco', 'CalidoSeco'),(5, 'Templado', 'Templado');
GO

-- Recomendaciones de plantas
INSERT INTO RecomendacionesPlantas (IdPlanta, InteriorExterior, NivelLuz, TieneMascotas, TiempoCuidado, TipoClima)
SELECT pl.IdPlanta, 'Interior', 'Luz indirecta brillante', 0, 'Medio', 'Tropical húmedo'
FROM Plantas pl INNER JOIN Productos p ON pl.IdProducto = p.IdProducto WHERE p.Nombre = 'Monstera Deliciosa';

INSERT INTO RecomendacionesPlantas (IdPlanta, InteriorExterior, NivelLuz, TieneMascotas, TiempoCuidado, TipoClima)
SELECT pl.IdPlanta, 'Interior', 'Luz indirecta o semisombra', 1, 'Bajo', 'Cálido seco'
FROM Plantas pl INNER JOIN Productos p ON pl.IdProducto = p.IdProducto WHERE p.Nombre = 'Sansevieria';

INSERT INTO RecomendacionesPlantas (IdPlanta, InteriorExterior, NivelLuz, TieneMascotas, TiempoCuidado, TipoClima)
SELECT pl.IdPlanta, 'Interior', 'Luz indirecta', 1, 'Bajo', 'Tropical'
FROM Plantas pl INNER JOIN Productos p ON pl.IdProducto = p.IdProducto WHERE p.Nombre = 'Pothos Dorado';

INSERT INTO RecomendacionesPlantas (IdPlanta, InteriorExterior, NivelLuz, TieneMascotas, TiempoCuidado, TipoClima)
SELECT pl.IdPlanta, 'Exterior', 'Sol directo', 0, 'Medio', 'Templado seco'
FROM Plantas pl INNER JOIN Productos p ON pl.IdProducto = p.IdProducto WHERE p.Nombre = 'Lavanda';

INSERT INTO RecomendacionesPlantas (IdPlanta, InteriorExterior, NivelLuz, TieneMascotas, TiempoCuidado, TipoClima)
SELECT pl.IdPlanta, 'Exterior', 'Sol parcial', 0, 'Medio', 'Templado tropical'
FROM Plantas pl INNER JOIN Productos p ON pl.IdProducto = p.IdProducto WHERE p.Nombre = 'Jazmín Estrella';
GO

-- Datos de prueba adicionales (carritos, compras, reservaciones, jardín, etc.)
INSERT INTO Carritos (IdUsuario, Estado) VALUES (1, 'Activo'), (2, 'Activo');

INSERT INTO CarritoDetalle (IdCarrito, IdProducto, Cantidad, PrecioUnitario)
SELECT 1, p.IdProducto, 2, p.Precio FROM Productos p WHERE p.Nombre = 'Café Latte';
INSERT INTO CarritoDetalle (IdCarrito, IdProducto, Cantidad, PrecioUnitario)
SELECT 1, p.IdProducto, 1, p.Precio FROM Productos p WHERE p.Nombre = 'Monstera Deliciosa';
INSERT INTO CarritoDetalle (IdCarrito, IdProducto, Cantidad, PrecioUnitario)
SELECT 2, p.IdProducto, 1, p.Precio FROM Productos p WHERE p.Nombre = 'Sándwich de pollo';

INSERT INTO Compras (IdUsuario, Subtotal, Impuesto, Total, MetodoEntrega, EstadoCompra)
VALUES (1, 15900, 2067, 17967, 'Retiro en tienda', 'Confirmada'),
       (2, 8000,  1040, 9040,  'Entrega a domicilio', 'Pendiente');

INSERT INTO Reservaciones (IdUsuario, FechaReservacion, HoraReservacion, CantidadPersonas, Estado, Comentarios)
VALUES (1, '2026-06-15', '18:30', 2, 'Confirmada', 'Mesa cerca del jardín.'),
       (2, '2026-06-18', '12:00', 4, 'Pendiente',  'Celebración familiar.');

INSERT INTO JardinVirtual (IdUsuario, IdPlanta, NombrePersonalizado, FechaAdquisicion, EstadoPlanta, Notas)
SELECT 1, pl.IdPlanta, 'Mi Monstera', '2026-06-03', 'Saludable', 'Ubicada en la sala.'
FROM Plantas pl INNER JOIN Productos p ON pl.IdProducto = p.IdProducto WHERE p.Nombre = 'Monstera Deliciosa';

INSERT INTO JardinVirtual (IdUsuario, IdPlanta, NombrePersonalizado, FechaAdquisicion, EstadoPlanta, Notas)
SELECT 1, pl.IdPlanta, 'Pothos de cocina', '2026-06-04', 'Saludable', 'Recibe luz indirecta.'
FROM Plantas pl INNER JOIN Productos p ON pl.IdProducto = p.IdProducto WHERE p.Nombre = 'Pothos Dorado';

INSERT INTO Notificaciones (IdUsuario, Titulo, Mensaje, Tipo, Leida) VALUES
    (1, 'Compra confirmada',    'Su compra fue registrada correctamente.',           'Compra',   0),
    (1, 'Riego pendiente',      'Hoy debe regar su Pothos de cocina.',               'Cuidado',  0),
    (2, 'Reservación pendiente','Su reservación está pendiente de confirmación.',    'Reserva',  0),
    (2, 'Nueva promoción',      'Disfrute café latte con descuento este fin de semana.', 'Promoción', 1);

INSERT INTO Promociones (Titulo, Descripcion, FechaInicio, FechaFin, Estado) VALUES
    ('Combo Café + Planta', 'Compre un café latte y obtenga 10% de descuento en plantas de interior.', '2026-06-01', '2026-06-15', 1),
    ('Semana Verde', 'Descuentos especiales en macetas y fertilizantes.', '2026-06-10', '2026-06-20', 1);

INSERT INTO Auditoria (IdUsuario, Accion, TablaAfectada, Detalle) VALUES
    (4, 'Registro de producto',        'Productos',     'El administrador registró productos iniciales.'),
    (4, 'Actualización de inventario', 'Productos',     'Se actualizaron existencias del vivero.'),
    (3, 'Confirmación de reservación', 'Reservaciones', 'Empleado confirmó una reservación.');
GO
