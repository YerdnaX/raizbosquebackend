# raizbosquebackend

API backend para la aplicación móvil **Raíces Café & Vivero**.

## Descripción

API REST creada con Node.js y Express que expone los datos del vivero y restaurante hacia la aplicación móvil. Se conecta a una base de datos SQL Server alojada en el servidor universitario.

## Tecnologías

- Node.js
- Express
- mssql (conexión a SQL Server)
- dotenv (variables de entorno)
- cors (acceso desde la app móvil)
- nodemon (solo desarrollo)

---

## Instalación local

```bash
npm install
```

Crear un archivo `.env` en la raíz del proyecto copiando `.env.example` y completando las credenciales reales:

```bash
cp .env.example .env
```

---

## Variables de entorno

Crear el archivo `.env` con los siguientes valores (usar credenciales reales, no subir a GitHub):

```
PORT=3000
DB_USER=tu_usuario_sql
DB_PASSWORD=tu_password_sql
DB_SERVER=tiusr15pl.cuc-carrera-ti.ac.cr
DB_DATABASE=tiusr15pl_RaicesCafeVivero
DB_PORT=1433
```

---

## Comandos

Desarrollo (con recarga automática):

```bash
npm run dev
```

Producción:

```bash
npm start
```

---

## Endpoints disponibles

| Método | Ruta             | Descripción                          |
|--------|------------------|--------------------------------------|
| GET    | `/`              | Verifica que la API está funcionando |
| GET    | `/api/health/db` | Verifica la conexión con SQL Server  |

---

## Publicar en Render

### Requisitos previos

1. Tener el proyecto subido a un repositorio de GitHub.
2. Tener una cuenta en [render.com](https://render.com).

### Pasos

1. Ir a [render.com](https://render.com) e iniciar sesión.

2. Hacer clic en **New** → **Web Service**.

3. Conectar el repositorio de GitHub y seleccionar `raizbosquebackend`.

4. Configurar el servicio:

   | Campo           | Valor                  |
   |-----------------|------------------------|
   | Name            | raizbosquebackend      |
   | Environment     | Node                   |
   | Build Command   | `npm install`          |
   | Start Command   | `npm start`            |

5. Ir a la sección **Environment Variables** y agregar:

   | Variable      | Valor                              |
   |---------------|------------------------------------|
   | PORT          | 3000                               |
   | DB_USER       | (tu usuario real)                  |
   | DB_PASSWORD   | (tu password real)                 |
   | DB_SERVER     | tiusr15pl.cuc-carrera-ti.ac.cr     |
   | DB_DATABASE   | tiusr15pl_RaicesCafeVivero         |
   | DB_PORT       | 1433                               |
   | NODE_VERSION  | 20                                 |

   > Las credenciales reales se agregan solo desde el dashboard de Render.
   > No deben escribirse en el código ni subirse a GitHub.

6. Hacer clic en **Deploy**.

7. Esperar que el build termine y revisar los logs.

8. Probar la URL generada por Render:

   ```
   GET https://nombre-del-servicio.onrender.com/
   GET https://nombre-del-servicio.onrender.com/api/health/db
   ```

---

## Estructura del proyecto

```
raizbosquebackend/
├── src/
│   ├── config/
│   │   └── db.js
│   ├── routes/
│   │   └── health.routes.js
│   ├── controllers/
│   │   └── health.controller.js
│   ├── app.js
│   └── server.js
├── Database/
│   ├── creadorDB.sql
│   └── datosprueba.sql
├── .env              (no subir a GitHub)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```
