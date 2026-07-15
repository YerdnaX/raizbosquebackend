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

Para el envio de correos de registro, recuperacion y usuario, este backend usa Gmail API con OAuth2 en lugar de SMTP. Debe agregar tambien:

```
GMAIL_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
GMAIL_REFRESH_TOKEN=1//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GMAIL_USER=tu_correo@gmail.com
EMAIL_TIMEOUT_MS=25000
```

Importante:

- El archivo [raizbosquebackend/src/services/emailService.js](raizbosquebackend/src/services/emailService.js) no usa `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER` ni `EMAIL_PASS`.
- Si solo configura SMTP en `.env`, las funciones de correo seguiran fallando.

---

## Error de Gmail OAuth2: invalid_grant

Si aparece este error:

```text
ERROR [apiClient] Status: 500 {"codigo":"EMAIL_ERROR","detalle":"Gmail token error: {\"error\":\"invalid_grant\",\"error_description\":\"Token has been expired or revoked.\"}"}
```

la causa real es que Google rechazo el `GMAIL_REFRESH_TOKEN` que el backend usa para pedir un `access_token` nuevo.

### Donde ocurre en este proyecto

- [raizbosquebackend/src/services/emailService.js](raizbosquebackend/src/services/emailService.js) solicita un token a `https://oauth2.googleapis.com/token`.
- Si Google responde error, el backend lanza `Gmail token error`.
- [raizbosquebackend/src/controllers/auth.controller.js](raizbosquebackend/src/controllers/auth.controller.js#L277) convierte eso en `EMAIL_ERROR` con HTTP 500.

### Como corregirlo

1. Verifique que la cuenta Gmail usada para enviar correos sea la misma que esta en `GMAIL_USER`.
2. Entre a Google Cloud Console con esa cuenta o con la cuenta propietaria del proyecto.
3. Abra el proyecto donde creo el OAuth Client ID.
4. Confirme que la API `Gmail API` este habilitada.
5. Revise la pantalla de consentimiento OAuth y asegurese de que el usuario Gmail este autorizado para usar la app si el proyecto esta en modo Testing.
6. Genere un refresh token nuevo para ese mismo `GMAIL_CLIENT_ID` y `GMAIL_CLIENT_SECRET`.
7. Actualice `GMAIL_REFRESH_TOKEN` en su entorno local o en Render.
8. Reinicie el backend despues de cambiar variables de entorno.
9. Pruebe otra vez el flujo que envia correo.

### Casos tipicos que producen `invalid_grant`

- El usuario revoco el acceso de la app desde su cuenta Google.
- Se regenero el OAuth Client y el refresh token viejo quedo invalido.
- El refresh token pertenece a otro `client_id` o a otra cuenta Gmail.
- La app OAuth sigue en modo Testing y el usuario no esta dentro de los test users.
- El refresh token se genero sin el alcance correcto de Gmail.

### Verificacion rapida que debe hacer en este repo

Compare estas dos cosas:

- [raizbosquebackend/src/services/emailService.js](raizbosquebackend/src/services/emailService.js) espera `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` y `GMAIL_USER`.
- Si su archivo `.env` o variables de Render solo tienen `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER` y `EMAIL_PASS`, la configuracion no corresponde al codigo actual.

### Recomendacion operativa

- Mantenga una sola estrategia de envio de correo por ambiente.
- Si seguira usando Gmail API, quite la dependencia operativa de SMTP en sus variables reales para evitar confusion.
- Si prefiere SMTP, entonces hay que reescribir [raizbosquebackend/src/services/emailService.js](raizbosquebackend/src/services/emailService.js) para usar SMTP de forma explicita.

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
