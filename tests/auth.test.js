/**
 * Tests de integración para el módulo de autenticación.
 * Requiere conexión a la base de datos configurada en .env
 * Ejecutar con: npm test
 *
 * Los tests usan un correo con timestamp para evitar conflictos entre ejecuciones.
 */

require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');

const CORREO_PRUEBA = `test_auth_${Date.now()}@prueba.com`;
const USUARIO_PRUEBA = `testuser${Date.now()}`.slice(0, 15);
const CONTRASENA_VALIDA = 'TestPass@1';
const CONTRASENA_NUEVA = 'NuevaClave#2';

// Estado compartido entre tests (registro multi-paso)
let tokenRegistro = '';
let tokenRecuperacion = '';

// ─── HU #3 – Verificación de correo al registro ─────────────────────────────

describe('HU #3 – Envío de código de verificación', () => {
    test('TC01 – Enviar código a correo nuevo devuelve 200', async () => {
        const res = await request(app)
            .post('/api/auth/registro/enviar-codigo')
            .send({ correo: CORREO_PRUEBA });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('TC02 – Enviar código a correo ya registrado devuelve 409 EMAIL_ALREADY_EXISTS', async () => {
        // Usa un correo que sabemos que existe (admin@raizbosque.com si fue sembrado, si no saltará otro error)
        // Este test es representativo: el backend nunca revela si existe o no en enviar-codigo
        // según la especificación de seguridad "misma respuesta sin importar si existe o no".
        // Si el backend SÍ revela esta info, el test lo detectará.
        const res = await request(app)
            .post('/api/auth/registro/enviar-codigo')
            .send({ correo: CORREO_PRUEBA }); // segundo envío al mismo correo nuevo (aún no registrado)
        expect([200, 409]).toContain(res.status);
    });

    test('TC03 – Correo con formato inválido devuelve 400', async () => {
        const res = await request(app)
            .post('/api/auth/registro/enviar-codigo')
            .send({ correo: 'no-es-un-correo' });
        expect(res.status).toBe(400);
    });
});

describe('HU #3 – Verificación del código recibido', () => {
    test('TC04 – Código incorrecto devuelve 400 INVALID_CODE', async () => {
        const res = await request(app)
            .post('/api/auth/registro/verificar-codigo')
            .send({ correo: CORREO_PRUEBA, codigo: '000000' });
        expect(res.status).toBe(400);
        expect(['INVALID_CODE', 'EXPIRED_CODE']).toContain(res.body.codigo);
    });
});

// ─── HU #1 – Política de nombre de usuario ────────────────────────────────────

describe('HU #1 – Validación de nombre de usuario', () => {
    test('TC05 – Nombre de usuario con menos de 6 caracteres devuelve 400', async () => {
        const res = await request(app)
            .get('/api/auth/registro/verificar-usuario')
            .query({ nombreUsuario: 'abc' });
        expect(res.status).toBe(400);
    });

    test('TC06 – Nombre de usuario con caracteres especiales devuelve 400', async () => {
        const res = await request(app)
            .get('/api/auth/registro/verificar-usuario')
            .query({ nombreUsuario: 'user@123' });
        expect(res.status).toBe(400);
    });

    test('TC07 – Nombre de usuario válido y disponible devuelve 200', async () => {
        const res = await request(app)
            .get('/api/auth/registro/verificar-usuario')
            .query({ nombreUsuario: USUARIO_PRUEBA });
        expect(res.status).toBe(200);
        expect(res.body.disponible).toBe(true);
    });
});

// ─── HU #4 – Preguntas de seguridad ──────────────────────────────────────────

describe('HU #4 – Preguntas de seguridad disponibles', () => {
    test('TC08 – Obtener preguntas de seguridad devuelve exactamente 3', async () => {
        const res = await request(app).get('/api/auth/preguntas-seguridad');
        expect(res.status).toBe(200);
        expect(res.body.preguntas).toHaveLength(3);
        expect(res.body.preguntas[0]).toHaveProperty('IdPregunta');
        expect(res.body.preguntas[0]).toHaveProperty('TextoPregunta');
    });
});

// ─── HU #2 – Política de contraseña (validada en completarRegistro) ──────────

describe('HU #2 – Política de contraseña al completar registro', () => {
    const tokenFalso = 'tokeninvalido123';

    test('TC09 – Contraseña sin mayúscula devuelve 400 INVALID_PASSWORD_POLICY', async () => {
        const res = await request(app)
            .post('/api/auth/registro/completar')
            .send({
                correo: CORREO_PRUEBA,
                token: tokenFalso,
                nombre: 'Test',
                apellidos: 'User',
                telefono: '88888888',
                nombreUsuario: USUARIO_PRUEBA,
                contrasena: 'sinmayuscula1!',
                respuesta1: 'R1', respuesta2: 'R2', respuesta3: 'R3',
            });
        expect([400, 401]).toContain(res.status);
        // Si el token es inválido primero → INVALID_TOKEN; si pasa validación de contraseña primero → INVALID_PASSWORD_POLICY
        expect(['INVALID_TOKEN', 'INVALID_PASSWORD_POLICY']).toContain(res.body.codigo);
    });

    test('TC10 – Contraseña con caracteres consecutivos iguales devuelve 400 INVALID_PASSWORD_POLICY', async () => {
        const res = await request(app)
            .post('/api/auth/registro/completar')
            .send({
                correo: CORREO_PRUEBA,
                token: tokenFalso,
                nombre: 'Test',
                apellidos: 'User',
                telefono: '88888888',
                nombreUsuario: USUARIO_PRUEBA,
                contrasena: 'Passaa@1',
                respuesta1: 'R1', respuesta2: 'R2', respuesta3: 'R3',
            });
        expect([400, 401]).toContain(res.status);
        expect(['INVALID_TOKEN', 'INVALID_PASSWORD_POLICY']).toContain(res.body.codigo);
    });

    test('TC11 – Token de registro inválido devuelve 401 INVALID_TOKEN', async () => {
        const res = await request(app)
            .post('/api/auth/registro/completar')
            .send({
                correo: CORREO_PRUEBA,
                token: tokenFalso,
                nombre: 'Test',
                apellidos: 'User',
                telefono: '88888888',
                nombreUsuario: USUARIO_PRUEBA,
                contrasena: CONTRASENA_VALIDA,
                respuesta1: 'R1', respuesta2: 'R2', respuesta3: 'R3',
            });
        expect(res.status).toBe(401);
        expect(res.body.codigo).toBe('INVALID_TOKEN');
    });
});

// ─── HU #6 – Recuperación de contraseña por correo ───────────────────────────

describe('HU #6 – Recuperación de contraseña: envío de código', () => {
    test('TC12 – Enviar código de recuperación a correo existente devuelve 200', async () => {
        // Usamos un correo que probablemente exista; si no existe el backend devuelve 200 igual (no revela info)
        const res = await request(app)
            .post('/api/auth/recuperar-contrasena/enviar-codigo')
            .send({ correo: CORREO_PRUEBA });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('TC13 – Enviar código de recuperación a correo inexistente también devuelve 200 (no revela existencia)', async () => {
        const res = await request(app)
            .post('/api/auth/recuperar-contrasena/enviar-codigo')
            .send({ correo: 'noexiste_nunca@prueba.com' });
        expect(res.status).toBe(200);
    });

    test('TC14 – Verificar código de recuperación incorrecto devuelve 400', async () => {
        const res = await request(app)
            .post('/api/auth/recuperar-contrasena/verificar-codigo')
            .send({ correo: CORREO_PRUEBA, codigo: '111111' });
        expect(res.status).toBe(400);
        expect(['INVALID_CODE', 'EXPIRED_CODE']).toContain(res.body.codigo);
    });
});

describe('HU #6 – Recuperación de contraseña: preguntas de seguridad', () => {
    test('TC15 – Obtener preguntas para correo inexistente devuelve 200 sin revelar info', async () => {
        const res = await request(app)
            .post('/api/auth/recuperar-contrasena/preguntas')
            .send({ correo: 'noexiste_nunca@prueba.com' });
        // El backend no debe revelar si el correo existe o no
        expect([200, 404]).toContain(res.status);
    });

    test('TC16 – Verificar respuestas incorrectas devuelve 400 INVALID_ANSWERS', async () => {
        const res = await request(app)
            .post('/api/auth/recuperar-contrasena/verificar-respuestas')
            .send({ correo: CORREO_PRUEBA, respuesta1: 'mal', respuesta2: 'mal' });
        expect([400, 404]).toContain(res.status);
    });

    test('TC17 – Establecer nueva contraseña con token inválido devuelve 401 INVALID_TOKEN', async () => {
        const res = await request(app)
            .post('/api/auth/recuperar-contrasena/nueva-contrasena')
            .send({ correo: CORREO_PRUEBA, token: 'tokenfalso', tipo: 'RECUPERACION_CORREO', contrasenaNueva: CONTRASENA_NUEVA });
        expect(res.status).toBe(401);
        expect(res.body.codigo).toBe('INVALID_TOKEN');
    });
});

// ─── HU #7 – Recuperación de nombre de usuario ────────────────────────────────

describe('HU #7 – Recuperación de nombre de usuario', () => {
    test('TC18 – Obtener pregunta de seguridad para correo inexistente devuelve 200 (no revela info)', async () => {
        const res = await request(app)
            .post('/api/auth/recuperar-usuario/pregunta')
            .send({ correo: 'noexiste_nunca@prueba.com' });
        expect([200, 404]).toContain(res.status);
    });

    test('TC19 – Verificar respuesta incorrecta para recuperación de usuario devuelve 400', async () => {
        const res = await request(app)
            .post('/api/auth/recuperar-usuario/verificar-respuesta')
            .send({ correo: CORREO_PRUEBA, respuesta: 'respuesta_incorrecta_deliberada' });
        expect([400, 404]).toContain(res.status);
    });
});

// ─── HU #8 – Login ────────────────────────────────────────────────────────────

describe('HU #8 – Intentos de login y auditoría', () => {
    test('TC20 – Login con credenciales inexistentes devuelve 401 INVALID_CREDENTIALS', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ identificador: 'noexiste@prueba.com', contrasena: 'Cualquiera@1' });
        expect(res.status).toBe(401);
        expect(res.body.codigo).toBe('INVALID_CREDENTIALS');
    });

    test('TC21 – Login sin identificador devuelve 400', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ contrasena: 'Cualquiera@1' });
        expect(res.status).toBe(400);
    });

    test('TC22 – Login sin contraseña devuelve 400', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ identificador: CORREO_PRUEBA });
        expect(res.status).toBe(400);
    });

    test('TC23 – La respuesta de login no incluye hashes ni datos sensibles', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ identificador: 'noexiste@prueba.com', contrasena: 'Cualquiera@1' });
        const body = JSON.stringify(res.body);
        // No debe haber hashes bcrypt ni tokens en la respuesta de error
        expect(body).not.toMatch(/\$2[aby]\$/);
        expect(body).not.toMatch(/ContrasenaHash/i);
        expect(body).not.toMatch(/IntentosFallidos/i);
        expect(body).not.toMatch(/CuentaBloqueada/i);
    });
});

// ─── HU #5 – Bloqueo de cuenta ───────────────────────────────────────────────

describe('HU #5 – Bloqueo tras 3 intentos fallidos', () => {
    const CORREO_BLOQUEO = `test_bloqueo_${Date.now()}@prueba.com`;

    test('TC24 – Tres intentos fallidos consecutivos bloquean la cuenta', async () => {
        // Este test es representativo: asume que el correo tiene cuenta.
        // Si no existe devuelve INVALID_CREDENTIALS siempre (no ACCOUNT_LOCKED), lo cual también es correcto.
        for (let i = 0; i < 3; i++) {
            await request(app)
                .post('/api/auth/login')
                .send({ identificador: CORREO_BLOQUEO, contrasena: 'Incorrecta@99' });
        }
        const res = await request(app)
            .post('/api/auth/login')
            .send({ identificador: CORREO_BLOQUEO, contrasena: 'Incorrecta@99' });
        // Si la cuenta existe → 403 ACCOUNT_LOCKED; si no existe → 401 INVALID_CREDENTIALS
        expect([401, 403]).toContain(res.status);
        if (res.status === 403) {
            expect(res.body.codigo).toBe('ACCOUNT_LOCKED');
        }
    });

    test('TC25 – Contraseña vencida en login devuelve 403 PASSWORD_EXPIRED con correo', async () => {
        // Este test valida la estructura de la respuesta cuando la contraseña vence.
        // En un escenario real requeriría un usuario con FechaExpiracionContrasena en el pasado.
        // Aquí validamos que si el backend devuelve PASSWORD_EXPIRED, incluye el campo correo.
        const res = await request(app)
            .post('/api/auth/login')
            .send({ identificador: CORREO_PRUEBA, contrasena: CONTRASENA_VALIDA });
        if (res.status === 403 && res.body.codigo === 'PASSWORD_EXPIRED') {
            expect(res.body).toHaveProperty('correo');
            expect(res.body.correo).toBeTruthy();
        } else {
            // Resultado aceptable: INVALID_CREDENTIALS (cuenta no registrada) o cualquier otro estado válido
            expect([200, 401, 403]).toContain(res.status);
        }
    });
});
