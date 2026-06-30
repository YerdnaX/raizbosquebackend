/**
 * seed_autenticacion.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Inserta datos de prueba para el módulo de autenticación.
 * Genera hashes reales con bcrypt (10 rondas) para contraseñas y respuestas.
 *
 * ANTES de ejecutar este script:
 *   1. Asegúrese de haber ejecutado cambios_seguridad_autenticacion.sql
 *   2. Opcionalmente limpie con limpiar_seguridad.sql
 *
 * Ejecutar desde la raíz del backend:
 *   node Database/seed_autenticacion.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Usuarios de prueba creados:
 *
 *  USUARIO NORMAL (activo)
 *   Correo:       ana.garcia@test.com
 *   Usuario:      anagarcia01
 *   Contraseña:   Bosque@2026
 *   Rol:          Cliente (IdRol=1)
 *
 *  USUARIO CON CONTRASEÑA VENCIDA
 *   Correo:       carlos.mora@test.com
 *   Usuario:      carlosmora02
 *   Contraseña:   Vivero#2025
 *   Rol:          Cliente (IdRol=1)
 *   Nota:         FechaExpiracionContrasena está 10 días en el pasado
 *
 *  USUARIO CON CUENTA BLOQUEADA
 *   Correo:       laura.jimenez@test.com
 *   Usuario:      laurajimenez03
 *   Contraseña:   Jardin!2024   (no funcionará hasta recuperar contraseña)
 *   Rol:          Cliente (IdRol=1)
 *   Nota:         CuentaBloqueada=1, IntentosFallidos=3
 *
 *  EMPLEADO NORMAL
 *   Correo:       diego.solis@test.com
 *   Usuario:      diegosolis04
 *   Contraseña:   Planta$2023
 *   Rol:          Empleado (IdRol=2)
 *
 *  ── USUARIOS ORIGINALES ACTUALIZADOS ─────────────────────────────────────
 *  carlos@email.com   →  Usuario: carlosramirez  │ Contraseña: Cafe@Bosque1
 *  maria@email.com    →  Usuario: mariafernandez  │ Contraseña: Vivero@Luna2
 *  andrea@raices.com  →  Usuario: andreasolano    │ Contraseña: Raices#Sol3
 *  admin@raices.com   →  Usuario: adminprincipal  │ Contraseña: Admin@Raiz1!
 */

require('dotenv').config();
const sql    = require('mssql');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;

// ─── Configuración de conexión ────────────────────────────────────────────────
const dbConfig = {
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server:   process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port:     Number(process.env.DB_PORT) || 1433,
    options:  { encrypt: false, trustServerCertificate: true },
};

// ─── Definición de usuarios de prueba ────────────────────────────────────────
const ahora   = new Date();
const hace130 = new Date(ahora.getTime() - 130 * 24 * 60 * 60 * 1000); // 130 días atrás
const hace10  = new Date(ahora.getTime() - 10  * 24 * 60 * 60 * 1000); // hace 10 días
const en120   = new Date(ahora.getTime() + 120 * 24 * 60 * 60 * 1000); // en 120 días

const PREGUNTAS = { P1: 1, P2: 2, P3: 3 };

const usuariosPrueba = [
    {
        correo:      'ana.garcia@test.com',
        nombre:      'Ana',
        apellidos:   'García Vargas',
        telefono:    '87651234',
        direccion:   'San José, Costa Rica',
        nombreUsuario: 'anagarcia01',
        contrasena:  'Bosque@2026',
        idRol:       1,
        bloqueada:   false,
        expiracion:  en120,
        creacion:    ahora,
        respuestas:  ['Morado brillante', 'Marte sin duda', 'Pizza napolitana'],
        descripcion: 'Cliente normal activo',
    },
    {
        correo:      'carlos.mora@test.com',
        nombre:      'Carlos',
        apellidos:   'Mora Jiménez',
        telefono:    '86542345',
        direccion:   'Cartago, Costa Rica',
        nombreUsuario: 'carlosmora02',
        contrasena:  'Vivero#2025',
        idRol:       1,
        bloqueada:   false,
        expiracion:  hace10,    // ← VENCIDA (hace 10 días)
        creacion:    hace130,
        respuestas:  ['Verde esmeralda', 'Júpiter gigante', 'Tacos de canasta'],
        descripcion: 'Cliente con contraseña VENCIDA',
    },
    {
        correo:      'laura.jimenez@test.com',
        nombre:      'Laura',
        apellidos:   'Jiménez Castro',
        telefono:    '85433456',
        direccion:   'Heredia, Costa Rica',
        nombreUsuario: 'laurajimenez03',
        contrasena:  'Jardin!2024',
        idRol:       1,
        bloqueada:   true,       // ← BLOQUEADA
        expiracion:  en120,
        creacion:    ahora,
        respuestas:  ['Azul zafiro', 'Saturno con anillos', 'Sushi de salmón'],
        descripcion: 'Cliente con cuenta BLOQUEADA (3 intentos fallidos)',
    },
    {
        correo:      'diego.solis@test.com',
        nombre:      'Diego',
        apellidos:   'Solís Mora',
        telefono:    '84324567',
        direccion:   'Alajuela, Costa Rica',
        nombreUsuario: 'diegosolis04',
        contrasena:  'Planta$2023',
        idRol:       2,
        bloqueada:   false,
        expiracion:  en120,
        creacion:    ahora,
        respuestas:  ['Dorado metálico', 'Venus luminosa', 'Ceviche costarricense'],
        descripcion: 'Empleado activo',
    },
];

// Actualizaciones para usuarios existentes (legado)
const actualizacionesLegado = [
    { correo: 'carlos@email.com',  nombreUsuario: 'carlosramirez',  contrasena: 'Cafe@Bosque1' },
    { correo: 'maria@email.com',   nombreUsuario: 'mariafernandez', contrasena: 'Vivero@Luna2' },
    { correo: 'andrea@raices.com', nombreUsuario: 'andreasolano',   contrasena: 'Raices#Sol3'  },
    { correo: 'admin@raices.com',  nombreUsuario: 'adminprincipal', contrasena: 'Admin@Raiz1!' },
];

// ─── Funciones helper ─────────────────────────────────────────────────────────

function formatoFecha(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function toSqlDate(date) {
    return formatoFecha(date);
}

// ─── Lógica principal ─────────────────────────────────────────────────────────

async function main() {
    let pool;
    try {
        console.log('\n🔌 Conectando a la base de datos...');
        pool = await sql.connect(dbConfig);
        console.log('✓ Conexión establecida\n');

        // ── 1. Verificar que las tablas de seguridad existen ──────────────────
        const verificar = await pool.request().query(`
            SELECT COUNT(*) AS cnt
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME IN ('RespuestasSeguridad','CodigosVerificacion','TokensTemporal','AuditoriaLogin','AuditoriaContrasena')
            AND TABLE_SCHEMA = 'dbo'
        `);
        if (verificar.recordset[0].cnt < 5) {
            console.error('✗ ERROR: Las tablas de seguridad no existen.');
            console.error('  Ejecute primero: cambios_seguridad_autenticacion.sql');
            process.exit(1);
        }

        // ── 2. Verificar que existen las 3 preguntas de seguridad ─────────────
        const preguntas = await pool.request().query(`SELECT COUNT(*) AS cnt FROM PreguntasSeguridad`);
        if (preguntas.recordset[0].cnt < 3) {
            console.error('✗ ERROR: No hay preguntas de seguridad sembradas.');
            console.error('  Ejecute primero: cambios_seguridad_autenticacion.sql');
            process.exit(1);
        }
        console.log('✓ Preguntas de seguridad verificadas (3 encontradas)\n');

        // ── 3. Insertar usuarios de prueba ────────────────────────────────────
        console.log('─── Creando usuarios de prueba ───────────────────────────');

        for (const u of usuariosPrueba) {
            // Verificar si ya existe
            const existe = await pool.request()
                .input('correo', sql.VarChar, u.correo)
                .query('SELECT IdUsuario FROM Usuarios WHERE Correo = @correo');

            if (existe.recordset.length > 0) {
                console.log(`  ⚠  ${u.correo} ya existe — omitido (ejecute limpiar_seguridad.sql primero)`);
                continue;
            }

            // Hashear contraseña
            process.stdout.write(`  Hasheando contraseña de ${u.correo}...`);
            const contrasenaHash = await bcrypt.hash(u.contrasena, BCRYPT_ROUNDS);
            console.log(' ✓');

            // Hashear respuestas
            process.stdout.write(`  Hasheando respuestas de seguridad...`);
            const hashes = await Promise.all(u.respuestas.map(r => bcrypt.hash(r, BCRYPT_ROUNDS)));
            console.log(' ✓');

            // Insertar usuario
            const insertResult = await pool.request()
                .input('idRol',             sql.Int,      u.idRol)
                .input('nombre',            sql.VarChar,  u.nombre)
                .input('apellidos',         sql.VarChar,  u.apellidos)
                .input('correo',            sql.VarChar,  u.correo)
                .input('telefono',          sql.VarChar,  u.telefono)
                .input('direccion',         sql.VarChar,  u.direccion)
                .input('nombreUsuario',     sql.VarChar,  u.nombreUsuario)
                .input('contrasenaHash',    sql.VarChar,  contrasenaHash)
                .input('creacion',          sql.DateTime, new Date(u.creacion))
                .input('expiracion',        sql.DateTime, new Date(u.expiracion))
                .input('intentosFallidos',  sql.Int,      u.bloqueada ? 3 : 0)
                .input('cuentaBloqueada',   sql.Bit,      u.bloqueada ? 1 : 0)
                .input('fechaBloqueo',      sql.DateTime, u.bloqueada ? new Date() : null)
                .query(`
                    INSERT INTO Usuarios (
                        IdRol, Nombre, Apellidos, Correo, Telefono, Direccion,
                        NombreUsuario, ContrasenaHash,
                        FechaCreacionContrasena, FechaExpiracionContrasena,
                        IntentosFallidos, CuentaBloqueada, FechaBloqueo,
                        CorreoVerificado, Estado
                    )
                    OUTPUT INSERTED.IdUsuario
                    VALUES (
                        @idRol, @nombre, @apellidos, @correo, @telefono, @direccion,
                        @nombreUsuario, @contrasenaHash,
                        @creacion, @expiracion,
                        @intentosFallidos, @cuentaBloqueada, @fechaBloqueo,
                        1, 1
                    )
                `);

            const idUsuario = insertResult.recordset[0].IdUsuario;

            // Insertar respuestas de seguridad
            const preguntaIds = [PREGUNTAS.P1, PREGUNTAS.P2, PREGUNTAS.P3];
            for (let i = 0; i < 3; i++) {
                await pool.request()
                    .input('idUsuario',    sql.Int,     idUsuario)
                    .input('idPregunta',   sql.Int,     preguntaIds[i])
                    .input('respuestaHash',sql.VarChar, hashes[i])
                    .query(`
                        INSERT INTO RespuestasSeguridad (IdUsuario, IdPregunta, RespuestaHash)
                        VALUES (@idUsuario, @idPregunta, @respuestaHash)
                    `);
            }

            const icono = u.bloqueada ? '🔒' : (u.expiracion < ahora ? '⏰' : '✅');
            console.log(`  ${icono} [IdUsuario=${idUsuario}] ${u.descripcion}`);
            console.log(`     Correo:   ${u.correo}`);
            console.log(`     Usuario:  ${u.nombreUsuario}`);
            console.log(`     Clave:    ${u.contrasena}`);
            if (u.bloqueada) console.log(`     Estado:   BLOQUEADA`);
            if (u.expiracion < ahora) console.log(`     Expiró:   ${toSqlDate(u.expiracion)}`);
            console.log();
        }

        // ── 4. Actualizar usuarios legado ─────────────────────────────────────
        console.log('─── Actualizando usuarios existentes (legado) ────────────');

        for (const leg of actualizacionesLegado) {
            const existe = await pool.request()
                .input('correo', sql.VarChar, leg.correo)
                .query('SELECT IdUsuario, ContrasenaHash FROM Usuarios WHERE Correo = @correo');

            if (existe.recordset.length === 0) {
                console.log(`  ⚠  ${leg.correo} no encontrado — omitido`);
                continue;
            }

            const { IdUsuario, ContrasenaHash } = existe.recordset[0];

            if (ContrasenaHash) {
                console.log(`  ⚠  ${leg.correo} ya tiene hash — omitido (ejecute limpiar_seguridad.sql para resetear)`);
                continue;
            }

            process.stdout.write(`  Hasheando ${leg.correo}...`);
            const contrasenaHash = await bcrypt.hash(leg.contrasena, BCRYPT_ROUNDS);
            console.log(' ✓');

            // Hashear respuestas genéricas para legado
            const respuestasLegado = ['Rojo brillante', 'Marte definitivo', 'Casado con arroz'];
            const hashes = await Promise.all(respuestasLegado.map(r => bcrypt.hash(r, BCRYPT_ROUNDS)));

            await pool.request()
                .input('idUsuario',     sql.Int,      IdUsuario)
                .input('nombreUsuario', sql.VarChar,  leg.nombreUsuario)
                .input('hash',          sql.VarChar,  contrasenaHash)
                .input('creacion',      sql.DateTime, new Date())
                .input('expiracion',    sql.DateTime, new Date(en120))
                .query(`
                    UPDATE Usuarios SET
                        NombreUsuario             = @nombreUsuario,
                        ContrasenaHash            = @hash,
                        FechaCreacionContrasena   = @creacion,
                        FechaExpiracionContrasena = @expiracion,
                        IntentosFallidos          = 0,
                        CuentaBloqueada           = 0,
                        FechaBloqueo              = NULL,
                        CorreoVerificado          = 1
                    WHERE IdUsuario = @idUsuario
                `);

            // Insertar respuestas si no existen
            const yaRespuestas = await pool.request()
                .input('idUsuario', sql.Int, IdUsuario)
                .query('SELECT COUNT(*) AS cnt FROM RespuestasSeguridad WHERE IdUsuario = @idUsuario');

            if (yaRespuestas.recordset[0].cnt === 0) {
                const preguntaIds = [PREGUNTAS.P1, PREGUNTAS.P2, PREGUNTAS.P3];
                for (let i = 0; i < 3; i++) {
                    await pool.request()
                        .input('idUsuario',     sql.Int,     IdUsuario)
                        .input('idPregunta',    sql.Int,     preguntaIds[i])
                        .input('respuestaHash', sql.VarChar, hashes[i])
                        .query(`
                            INSERT INTO RespuestasSeguridad (IdUsuario, IdPregunta, RespuestaHash)
                            VALUES (@idUsuario, @idPregunta, @respuestaHash)
                        `);
                }
            }

            console.log(`  ✅ [IdUsuario=${IdUsuario}] ${leg.correo}`);
            console.log(`     Usuario: ${leg.nombreUsuario}`);
            console.log(`     Clave:   ${leg.contrasena}`);
            console.log();
        }

        // ── 5. Resumen final ──────────────────────────────────────────────────
        console.log('─── Resumen final ────────────────────────────────────────');
        const resumen = await pool.request().query(`
            SELECT
                IdUsuario,
                Correo,
                NombreUsuario,
                CASE WHEN ContrasenaHash IS NOT NULL THEN 'Sí' ELSE 'No' END AS TieneHash,
                CASE WHEN CuentaBloqueada = 1 THEN 'BLOQUEADA' ELSE 'Activa' END AS EstadoCuenta,
                CASE WHEN FechaExpiracionContrasena < GETDATE() THEN 'VENCIDA' ELSE 'Vigente' END AS Contrasena,
                (SELECT COUNT(*) FROM RespuestasSeguridad rs WHERE rs.IdUsuario = u.IdUsuario) AS Respuestas
            FROM Usuarios u
            ORDER BY IdUsuario
        `);

        console.log('\n  ID │ Correo                      │ Usuario          │ Hash │ Cuenta    │ Contraseña │ Resp');
        console.log('  ───┼─────────────────────────────┼──────────────────┼──────┼───────────┼────────────┼─────');
        for (const r of resumen.recordset) {
            const id      = String(r.IdUsuario).padEnd(3);
            const correo  = (r.Correo || '').padEnd(28).slice(0,28);
            const usuario = (r.NombreUsuario || '(sin usuario)').padEnd(17).slice(0,17);
            const hash    = (r.TieneHash || 'No').padEnd(5);
            const cuenta  = (r.EstadoCuenta || '').padEnd(10);
            const clave   = (r.Contrasena || '').padEnd(11);
            const resp    = String(r.Respuestas);
            console.log(`  ${id} │ ${correo} │ ${usuario}│ ${hash}│ ${cuenta}│ ${clave}│ ${resp}`);
        }

        console.log('\n✅ Seed completado exitosamente.\n');
        console.log('─── Credenciales de prueba ───────────────────────────────');
        console.log('  Normal:    ana.garcia@test.com   │ anagarcia01    │ Bosque@2026');
        console.log('  Vencida:   carlos.mora@test.com  │ carlosmora02   │ Vivero#2025');
        console.log('  Bloqueada: laura.jimenez@test.com│ laurajimenez03 │ Jardin!2024');
        console.log('  Empleado:  diego.solis@test.com  │ diegosolis04   │ Planta$2023');
        console.log('─────────────────────────────────────────────────────────');
        console.log('  Carlos:    carlos@email.com       │ carlosramirez  │ Cafe@Bosque1');
        console.log('  María:     maria@email.com        │ mariafernandez │ Vivero@Luna2');
        console.log('  Andrea:    andrea@raices.com      │ andreasolano   │ Raices#Sol3');
        console.log('  Admin:     admin@raices.com       │ adminprincipal │ Admin@Raiz1!');
        console.log('─────────────────────────────────────────────────────────\n');
        console.log('  Respuestas de seguridad (usuarios @test.com):');
        console.log('  P1 – ¿Qué color tendría su dragón?');
        console.log('       Ana: "Morado brillante" │ Carlos: "Verde esmeralda" │ Laura: "Azul zafiro" │ Diego: "Dorado metálico"');
        console.log('  P2 – ¿Qué planeta visitaría primero?');
        console.log('       Ana: "Marte sin duda" │ Carlos: "Júpiter gigante" │ Laura: "Saturno con anillos" │ Diego: "Venus luminosa"');
        console.log('  P3 – ¿Qué comida defendería en una discusión absurda?');
        console.log('       Ana: "Pizza napolitana" │ Carlos: "Tacos de canasta" │ Laura: "Sushi de salmón" │ Diego: "Ceviche costarricense"');
        console.log('');
        console.log('  ⚠  Las respuestas son sensibles a mayúsculas y minúsculas.');
        console.log('  ⚠  Los usuarios legado tienen: "Rojo brillante", "Marte definitivo", "Casado con arroz"\n');

    } catch (error) {
        console.error('\n✗ Error durante el seed:', error.message);
        if (error.code) console.error('  Código:', error.code);
        process.exit(1);
    } finally {
        if (pool) await pool.close();
    }
}

main();
