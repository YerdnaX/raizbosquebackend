USE tiusr15pl_RaicesCafeVivero;
GO

CREATE TABLE Roles (
    IdRol INT IDENTITY(1,1) PRIMARY KEY,
    NombreRol VARCHAR(50) NOT NULL
);

CREATE TABLE Usuarios (
    IdUsuario INT IDENTITY(1,1) PRIMARY KEY,
    IdRol INT NOT NULL,
    Nombre VARCHAR(100) NOT NULL,
    Apellidos VARCHAR(150) NOT NULL,
    Correo VARCHAR(150) NOT NULL UNIQUE,
    Telefono VARCHAR(20),
    Direccion VARCHAR(300),
    Contrasena VARCHAR(255) NOT NULL,
    Estado BIT DEFAULT 1,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (IdRol) REFERENCES Roles(IdRol)
);

CREATE TABLE Categorias (
    IdCategoria INT IDENTITY(1,1) PRIMARY KEY,
    NombreCategoria VARCHAR(100) NOT NULL,
    Tipo VARCHAR(50) NOT NULL
);

CREATE TABLE Productos (
    IdProducto INT IDENTITY(1,1) PRIMARY KEY,
    IdCategoria INT NOT NULL,
    Nombre VARCHAR(150) NOT NULL,
    Descripcion VARCHAR(500),
    Precio DECIMAL(10,2) NOT NULL,
    Imagen VARCHAR(300),
    TipoProducto VARCHAR(50) NOT NULL,
    Disponible BIT DEFAULT 1,
    Stock INT DEFAULT 0,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (IdCategoria) REFERENCES Categorias(IdCategoria)
);

CREATE TABLE Plantas (
    IdPlanta INT IDENTITY(1,1) PRIMARY KEY,
    IdProducto INT NOT NULL UNIQUE,
    TipoClima VARCHAR(100),
    TemperaturaRecomendada VARCHAR(100),
    FrecuenciaRiego VARCHAR(100),
    NivelLuz VARCHAR(100),
    TipoSuelo VARCHAR(100),
    CuidadosEspeciales VARCHAR(500),
    TamanoAproximado VARCHAR(100),
    NivelDificultad VARCHAR(50),
    TieneQR BIT DEFAULT 0,
    CodigoQR VARCHAR(100),
    FOREIGN KEY (IdProducto) REFERENCES Productos(IdProducto)
);

CREATE TABLE PreguntasRecomendador (
    IdPregunta INT IDENTITY(1,1) PRIMARY KEY,
    Pregunta VARCHAR(300) NOT NULL,
    Estado BIT DEFAULT 1
);

CREATE TABLE OpcionesRecomendador (
    IdOpcion INT IDENTITY(1,1) PRIMARY KEY,
    IdPregunta INT NOT NULL,
    TextoOpcion VARCHAR(200) NOT NULL,
    Valor VARCHAR(100) NOT NULL,
    FOREIGN KEY (IdPregunta) REFERENCES PreguntasRecomendador(IdPregunta)
);

CREATE TABLE RecomendacionesPlantas (
    IdRecomendacion INT IDENTITY(1,1) PRIMARY KEY,
    IdPlanta INT NOT NULL,
    InteriorExterior VARCHAR(50),
    NivelLuz VARCHAR(100),
    TieneMascotas BIT,
    TiempoCuidado VARCHAR(100),
    TipoClima VARCHAR(100),
    FOREIGN KEY (IdPlanta) REFERENCES Plantas(IdPlanta)
);

CREATE TABLE Carritos (
    IdCarrito INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    Estado VARCHAR(50) DEFAULT 'Activo',
    FechaCreacion DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

CREATE TABLE CarritoDetalle (
    IdDetalle INT IDENTITY(1,1) PRIMARY KEY,
    IdCarrito INT NOT NULL,
    IdProducto INT NOT NULL,
    Cantidad INT NOT NULL,
    PrecioUnitario DECIMAL(10,2) NOT NULL,
    Subtotal AS (Cantidad * PrecioUnitario),
    FOREIGN KEY (IdCarrito) REFERENCES Carritos(IdCarrito),
    FOREIGN KEY (IdProducto) REFERENCES Productos(IdProducto)
);

CREATE TABLE Compras (
    IdCompra INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    FechaCompra DATETIME DEFAULT GETDATE(),
    Subtotal DECIMAL(10,2) NOT NULL,
    Impuesto DECIMAL(10,2) NOT NULL,
    Total DECIMAL(10,2) NOT NULL,
    MetodoEntrega VARCHAR(50) NOT NULL,
    DireccionEntrega VARCHAR(300),
    EstadoCompra VARCHAR(50) DEFAULT 'Pendiente',
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

CREATE TABLE CompraDetalle (
    IdCompraDetalle INT IDENTITY(1,1) PRIMARY KEY,
    IdCompra INT NOT NULL,
    IdProducto INT NOT NULL,
    Cantidad INT NOT NULL,
    PrecioUnitario DECIMAL(10,2) NOT NULL,
    Subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (IdCompra) REFERENCES Compras(IdCompra),
    FOREIGN KEY (IdProducto) REFERENCES Productos(IdProducto)
);

CREATE TABLE Reservaciones (
    IdReservacion INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    FechaReservacion DATE NOT NULL,
    HoraReservacion TIME NOT NULL,
    CantidadPersonas INT NOT NULL,
    Estado VARCHAR(50) DEFAULT 'Pendiente',
    Comentarios VARCHAR(300),
    FechaRegistro DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

CREATE TABLE JardinVirtual (
    IdJardin INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    IdPlanta INT NOT NULL,
    NombrePersonalizado VARCHAR(100),
    FechaAdquisicion DATE DEFAULT GETDATE(),
    EstadoPlanta VARCHAR(50) DEFAULT 'Saludable',
    Notas VARCHAR(500),
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario),
    FOREIGN KEY (IdPlanta) REFERENCES Plantas(IdPlanta)
);

CREATE TABLE CuidadosPlantas (
    IdCuidado INT IDENTITY(1,1) PRIMARY KEY,
    IdJardin INT NOT NULL,
    TipoCuidado VARCHAR(100) NOT NULL,
    FechaProgramada DATE NOT NULL,
    Realizado BIT DEFAULT 0,
    FechaRealizado DATETIME,
    Observacion VARCHAR(300),
    FOREIGN KEY (IdJardin) REFERENCES JardinVirtual(IdJardin)
);

CREATE TABLE Notificaciones (
    IdNotificacion INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    Titulo VARCHAR(150) NOT NULL,
    Mensaje VARCHAR(500) NOT NULL,
    Tipo VARCHAR(50),
    Leida BIT DEFAULT 0,
    Fecha DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

CREATE TABLE Promociones (
    IdPromocion INT IDENTITY(1,1) PRIMARY KEY,
    Titulo VARCHAR(150) NOT NULL,
    Descripcion VARCHAR(500),
    FechaInicio DATE NOT NULL,
    FechaFin DATE NOT NULL,
    Estado BIT DEFAULT 1
);

CREATE TABLE Calificaciones (
    IdCalificacion INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    IdProducto INT NOT NULL,
    Puntuacion INT CHECK (Puntuacion BETWEEN 1 AND 5),
    Fecha DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario),
    FOREIGN KEY (IdProducto) REFERENCES Productos(IdProducto)
);

CREATE TABLE Comentarios (
    IdComentario INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    IdProducto INT NOT NULL,
    Comentario VARCHAR(500) NOT NULL,
    Estado BIT DEFAULT 1,
    Fecha DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario),
    FOREIGN KEY (IdProducto) REFERENCES Productos(IdProducto)
);

CREATE TABLE Auditoria (
    IdAuditoria INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NULL,
    Accion VARCHAR(200) NOT NULL,
    TablaAfectada VARCHAR(100),
    Fecha DATETIME DEFAULT GETDATE(),
    Detalle VARCHAR(500),
    FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);
GO