# AGENTS.md

Este archivo contiene las reglas y guías de trabajo para agentes de IA que ayuden a desarrollar este proyecto.

El proyecto es una API REST creada con **Node.js y Express**, pensada como proyecto académico. El código debe ser claro, simple y fácil de entender.

No sobreingenierizar.

No crear soluciones complejas para problemas que el proyecto todavía no tiene.

---

# 1. Principios generales

Al trabajar en este proyecto, priorizar siempre:

1. Simplicidad.
2. Claridad.
3. Código fácil de leer.
4. Archivos pequeños.
5. Nombres descriptivos.
6. Soluciones prácticas antes que arquitecturas complejas.
7. Código adecuado para una persona que está aprendiendo Node.js y Express.

Evitar patrones avanzados si no son necesarios.

---

# 2. Stack tecnológico

El proyecto usa el siguiente stack:

```txt
Node.js
Express
mssql
dotenv
cors
nodemon (solo desarrollo)
```

No agregar nuevas dependencias sin aprobación explícita.

No usar:

```txt
Prisma
Sequelize
TypeORM
TypeScript
JWT (hasta que se solicite)
Docker (hasta que se solicite)
```

---

# 3. Estructura del proyecto

```txt
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
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

Mantener esta estructura. No crear capas adicionales sin aprobación.

No crear:

```txt
services/
repositories/
middlewares/
models/
utils/
```

A menos que se solicite explícitamente.

---

# 4. Flujo para agregar una nueva funcionalidad

Cuando se pida agregar una nueva ruta, seguir siempre este orden:

```txt
1. Crear el controlador en src/controllers/
2. Crear la ruta en src/routes/
3. Registrar la ruta en src/app.js
```

Ejemplo para una funcionalidad de productos:

```txt
src/controllers/productos.controller.js
src/routes/productos.routes.js
src/app.js  ← registrar la ruta nueva aquí
```

---

# 5. Convención de nombres de archivos

Usar kebab-case para los archivos dentro de `routes/` y `controllers/`.

Formato: `[nombre].[tipo].js`

Ejemplos correctos:

```txt
productos.routes.js
productos.controller.js
usuarios.routes.js
usuarios.controller.js
reservaciones.routes.js
reservaciones.controller.js
```

Ejemplos incorrectos:

```txt
ProductosRoutes.js
productos_routes.js
routerProductos.js
```

---

# 6. Estructura de un controlador

Cada función de controlador debe:

1. Obtener la conexión con `getConnection()`.
2. Ejecutar la consulta SQL.
3. Retornar el resultado en JSON.
4. Capturar errores con try/catch y responder con status 500.

Ejemplo correcto:

```js
const { getConnection } = require('../config/db');

async function obtenerProductos(req, res) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT * FROM Productos WHERE Disponible = 1');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
}

module.exports = { obtenerProductos };
```

No usar `console.log` para datos sensibles.

No retornar el objeto de error completo al cliente.

---

# 7. Estructura de una ruta

Cada archivo de rutas debe:

1. Importar `express` y crear un `router`.
2. Importar el controlador correspondiente.
3. Definir las rutas.
4. Exportar el router.

Ejemplo correcto:

```js
const express = require('express');
const router = express.Router();
const { obtenerProductos } = require('../controllers/productos.controller');

router.get('/', obtenerProductos);

module.exports = router;
```

---

# 8. Registro de rutas en app.js

Cada nueva ruta debe registrarse en `src/app.js` con un prefijo claro.

Ejemplo:

```js
const productosRoutes = require('./routes/productos.routes');

app.use('/api/productos', productosRoutes);
```

Prefijos recomendados por recurso:

```txt
/api/health
/api/auth
/api/productos
/api/plantas
/api/categorias
/api/usuarios
/api/carritos
/api/compras
/api/reservaciones
/api/jardin
/api/recomendaciones
/api/notificaciones
/api/promociones
```

---

# 9. URL base de la API

La API está publicada en Render en la siguiente URL:

```txt
https://raizbosquebackend.onrender.com
```

Esta es la URL base que debe usarse siempre al:

- Referenciar endpoints en documentación.
- Construir ejemplos de curl.
- Indicar URLs al equipo de la app móvil.

Ejemplos de endpoints completos:

```txt
GET  https://raizbosquebackend.onrender.com/
GET  https://raizbosquebackend.onrender.com/api/health/db
POST https://raizbosquebackend.onrender.com/api/auth/login
```

Para desarrollo local usar:

```txt
http://localhost:3000
```

Nunca usar localhost como URL de referencia en documentación o ejemplos que van al equipo de la app móvil.

> Nota: Render en el plan gratuito puede tardar ~30 segundos en responder la primera petición si el servicio estuvo inactivo.

---

# 10. Consultas SQL

Usar consultas SQL simples directamente con `mssql`.

No usar ORM.

No usar query builders.

Ejemplo correcto:

```js
const result = await pool.request().query('SELECT * FROM Productos WHERE Disponible = 1');
```

Para consultas con parámetros, usar inputs para evitar inyección SQL:

```js
const result = await pool.request()
  .input('id', sql.Int, req.params.id)
  .query('SELECT * FROM Productos WHERE IdProducto = @id');
```

No concatenar parámetros directamente en el string SQL:

```js
// INCORRECTO - nunca hacer esto
.query(`SELECT * FROM Productos WHERE IdProducto = ${req.params.id}`)
```

---

# 11. Base de datos

La conexión a SQL Server está centralizada en `src/config/db.js`.

No crear conexiones nuevas fuera de ese archivo.

No importar `mssql` directamente en controllers o routes.

Siempre importar desde `db.js`:

```js
const { getConnection, sql } = require('../config/db');
```

Importar `sql` solo cuando se necesiten tipos para `.input()`.

---

# 12. Tablas disponibles en la base de datos

La base de datos se llama `tiusr15pl_RaicesCafeVivero`.

Tablas existentes:

```txt
Roles
Usuarios
Categorias
Productos
Plantas
PreguntasRecomendador
OpcionesRecomendador
RecomendacionesPlantas
Carritos
CarritoDetalle
Compras
CompraDetalle
Reservaciones
JardinVirtual
CuidadosPlantas
Notificaciones
Promociones
Calificaciones
Comentarios
Auditoria
```

No inventar tablas.

No asumir columnas que no existen.

Si se necesita conocer la estructura exacta de una tabla, revisar `Database/creadorDB.sql`.

---

# 13. Variables de entorno

Las credenciales y configuración sensible deben estar en `.env`.

El archivo `.env` NO debe subirse a GitHub.

Usar siempre `process.env.NOMBRE_VARIABLE` en el código.

Variables disponibles:

```txt
PORT
DB_USER
DB_PASSWORD
DB_SERVER
DB_DATABASE
DB_PORT
```

No hardcodear valores de conexión en el código.

No hardcodear el puerto.

Correcto:

```js
const PORT = process.env.PORT || 3000;
```

Incorrecto:

```js
app.listen(3000, ...);
```

---

# 14. Respuestas de la API

Las respuestas deben ser JSON consistentes.

Para listas de datos:

```json
[
  { "IdProducto": 1, "Nombre": "Café Latte", "Precio": 2200 }
]
```

Para operaciones de estado (health checks, confirmaciones):

```json
{ "success": true, "message": "Descripción del resultado" }
```

Para errores:

```json
{ "error": "Descripción del error" }
```

Usar códigos HTTP correctos:

```txt
200 → respuesta exitosa
201 → recurso creado
400 → error del cliente (datos inválidos)
404 → recurso no encontrado
500 → error del servidor
```

---

# 15. Manejo de errores

Usar try/catch en todos los controladores.

No dejar promesas sin manejar.

No exponer mensajes internos de error al cliente.

Correcto:

```js
} catch (error) {
  res.status(500).json({ error: 'Error al obtener los datos' });
}
```

Incorrecto:

```js
} catch (error) {
  res.status(500).json({ error: error.message });
}
```

---

# 16. Comentarios

Escribir comentarios solo cuando expliquen una razón importante.

Buen comentario:

```js
// Se usa trustServerCertificate porque el servidor universitario usa certificado autofirmado.
```

Mal comentario:

```js
// Obtiene todos los productos
const result = await pool.request().query('SELECT * FROM Productos');
```

Evitar comentarios obvios.

---

# 17. Scripts del proyecto

Los scripts disponibles en `package.json` son:

```txt
npm start     → inicia el servidor con node (producción)
npm run dev   → inicia el servidor con nodemon (desarrollo)
```

No agregar scripts sin necesidad.

---

# 18. Deploy en Render

El proyecto está configurado para publicarse en Render como Web Service.

Configuración de Render:

```txt
Environment:     Node
Build Command:   npm install
Start Command:   npm start
```

Las variables de entorno deben agregarse desde el dashboard de Render:

```txt
Dashboard → Web Service → Environment → Environment Variables
```

No agregar las credenciales reales al código.

No agregar las credenciales reales al README.

---

# 19. Qué NO hacer

No hacer sobreingeniería.

Evitar:

```txt
Prisma, Sequelize, TypeORM
TypeScript (hasta que se solicite)
JWT (hasta que se solicite)
Docker (hasta que se solicite)
Middlewares de autenticación sin solicitud
Capas de services o repositories sin solicitud
Query builders complejos
Concatenación de parámetros en SQL (riesgo de inyección)
Hardcodear credenciales en el código
Subir .env a GitHub
Inventar tablas o columnas que no existen
Crear rutas sin revisar la estructura de la DB
```

---

# 20. Reglas para agentes de IA

Cuando un agente de IA trabaje en este proyecto, debe:

1. Mantener los cambios pequeños y enfocados.
2. Usar la estructura existente del proyecto.
3. Seguir el flujo: controlador → ruta → registro en app.js.
4. No modificar archivos no relacionados con la tarea.
5. No agregar dependencias sin permiso.
6. No cambiar la arquitectura sin explicar.
7. No usar ORM ni TypeScript.
8. No inventar tablas ni columnas.
9. Revisar `Database/creadorDB.sql` si necesita conocer la estructura real de una tabla.
10. Usar siempre `getConnection()` de `src/config/db.js`.
11. Usar `.input()` de mssql para parámetros en consultas SQL.
12. No exponer errores internos al cliente.
13. No hardcodear credenciales ni puertos.
14. Explicar qué archivos se crean o modifican.
15. Dar el código completo de cada archivo modificado.

---

# 21. Estilo de respuesta esperado del agente

Cuando el agente explique cambios, debe usar un formato claro.

Ejemplo:

```txt
Crear este archivo:

src/controllers/productos.controller.js

Agregar este código:

...

Luego crear este archivo:

src/routes/productos.routes.js

Agregar este código:

...

Luego actualizar este archivo:

src/app.js

Agregar esta línea:

...
```

Evitar respuestas vagas como:

```txt
Se recomienda desacoplar la lógica y usar una arquitectura escalable.
```

Preferir explicaciones concretas, cortas y aplicables.

---

# 22. Regla final

Este es un proyecto académico.

El objetivo no es construir una arquitectura perfecta.

El objetivo es construir una API clara, funcional y fácil de entender.

Mantener el código simple.

Mantener el proyecto ordenado.

No diseñar para problemas que todavía no existen.

Al implementar una nueva ruta o cambio sobre alguna ruta existente brinde el CURL apropiado para probar
