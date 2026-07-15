/**
 * seed_ubicaciones_geograficas.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Carga la división administrativa completa de Costa Rica, Panamá y Estados
 * Unidos en la tabla jerárquica UbicacionesGeograficas.
 *
 * ANTES de ejecutar este script:
 *   1. Ejecute la migración: Database/004_ubicaciones_geograficas.sql
 *
 * Ejecutar desde la raíz del backend (raizbosquebackend):
 *   node Database/seed_ubicaciones_geograficas.js
 *
 * Es seguro ejecutarlo más de una vez: cada nodo se busca por
 * (Nombre, Nivel, IdUbicacionPadre) antes de insertarlo, así que no se
 * duplica nada en ejecuciones repetidas. Toda la carga corre dentro de una
 * única transacción: si algo falla, no queda data parcial.
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const sql = require('mssql');

const costaRica = require('./data/ubicaciones-costa-rica');
const panama = require('./data/ubicaciones-panama');
const estadosUnidos = require('./data/ubicaciones-estados-unidos');

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: Number(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT ? process.env.DB_ENCRYPT === 'true' : true,
    trustServerCertificate: process.env.DB_TRUST_CERT ? process.env.DB_TRUST_CERT === 'true' : true,
  },
};

const resumen = { nuevos: 0, existentes: 0 };

async function buscarNodo(transaction, nombre, nivel, idPadre) {
  const request = new sql.Request(transaction);
  request.input('nombre', sql.VarChar(150), nombre);
  request.input('nivel', sql.Int, nivel);

  const condicionPadre = idPadre === null ? 'IdUbicacionPadre IS NULL' : 'IdUbicacionPadre = @idPadre';
  if (idPadre !== null) {
    request.input('idPadre', sql.Int, idPadre);
  }

  const resultado = await request.query(`
    SELECT IdUbicacion FROM UbicacionesGeograficas
    WHERE Nombre = @nombre AND Nivel = @nivel AND ${condicionPadre}
  `);

  return resultado.recordset.length > 0 ? resultado.recordset[0].IdUbicacion : null;
}

async function insertarNodo(transaction, nombre, nivel, idPadre) {
  const request = new sql.Request(transaction);
  request.input('nombre', sql.VarChar(150), nombre);
  request.input('nivel', sql.Int, nivel);
  request.input('idPadre', sql.Int, idPadre);

  const resultado = await request.query(`
    INSERT INTO UbicacionesGeograficas (IdUbicacionPadre, Nivel, Nombre)
    OUTPUT INSERTED.IdUbicacion
    VALUES (@idPadre, @nivel, @nombre)
  `);

  return resultado.recordset[0].IdUbicacion;
}

async function insertarArbol(transaction, nodo, nivel, idPadre) {
  let idNodo = await buscarNodo(transaction, nodo.nombre, nivel, idPadre);

  if (idNodo === null) {
    idNodo = await insertarNodo(transaction, nodo.nombre, nivel, idPadre);
    resumen.nuevos++;
  } else {
    resumen.existentes++;
  }

  if (nodo.hijos) {
    for (const hijo of nodo.hijos) {
      await insertarArbol(transaction, hijo, nivel + 1, idNodo);
    }
  }

  return idNodo;
}

async function main() {
  let pool;
  try {
    console.log('\n🔌 Conectando a la base de datos...');
    pool = await sql.connect(dbConfig);
    console.log('✓ Conexión establecida\n');

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      console.log('─── Sembrando Costa Rica (país → provincia → cantón → distrito) ───');
      await insertarArbol(transaction, costaRica, 1, null);

      console.log('─── Sembrando Panamá (país → provincia/comarca → distrito → corregimiento) ───');
      await insertarArbol(transaction, panama, 1, null);

      console.log('─── Sembrando Estados Unidos (país → estado → ciudad) ───');
      await insertarArbol(transaction, estadosUnidos, 1, null);

      await transaction.commit();
      console.log('\n✅ Seed completado exitosamente.');
      console.log(`   Nodos nuevos insertados: ${resumen.nuevos}`);
      console.log(`   Nodos ya existentes (omitidos): ${resumen.existentes}\n`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('\n✗ Error durante el seed, no se guardó ningún cambio:', error.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.close();
  }
}

module.exports = { insertarArbol, main };

if (require.main === module) {
  main();
}
