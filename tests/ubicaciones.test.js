/**
 * Tests de integración para la jerarquía de ubicaciones geográficas.
 * Requiere conexión a la base de datos configurada en .env, con la migración
 * Database/004_ubicaciones_geograficas.sql y el seed
 * Database/seed_ubicaciones_geograficas.js ya ejecutados.
 * Ejecutar con: npm test
 */

require('dotenv').config();
const request = require('supertest');
const sql = require('mssql');
const app = require('../src/app');
const ubicacionesService = require('../src/services/ubicacionesService');
const { insertarArbol } = require('../Database/seed_ubicaciones_geograficas');
const { getConnection } = require('../src/config/db');

async function buscarIdPorNombreYNivel(nombre, nivel, idPadre) {
  const hijos = idPadre === null
    ? await ubicacionesService.obtenerPaises()
    : await ubicacionesService.obtenerHijos(idPadre);
  const encontrado = hijos.find((u) => u.Nombre === nombre);
  return encontrado ? encontrado.IdUbicacion : null;
}

describe('GET /api/ubicaciones/paises', () => {
  test('TC01 – Devuelve los 3 países soportados', async () => {
    const res = await request(app).get('/api/ubicaciones/paises');
    expect(res.status).toBe(200);
    const nombres = res.body.map((pais) => pais.Nombre);
    expect(nombres).toEqual(expect.arrayContaining(['Costa Rica', 'Panamá', 'Estados Unidos']));
  });
});

describe('GET /api/ubicaciones/:idUbicacion/hijos', () => {
  test('TC02 – Hijos de Costa Rica devuelve sus 7 provincias', async () => {
    const idCostaRica = await buscarIdPorNombreYNivel('Costa Rica', 1, null);
    expect(idCostaRica).not.toBeNull();

    const res = await request(app).get(`/api/ubicaciones/${idCostaRica}/hijos`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    expect(res.body.map((p) => p.Nombre)).toContain('San José');
  });

  test('TC03 – Hijos de una división administrativa (cantones de San José)', async () => {
    const idCostaRica = await buscarIdPorNombreYNivel('Costa Rica', 1, null);
    const idSanJose = await buscarIdPorNombreYNivel('San José', 2, idCostaRica);
    expect(idSanJose).not.toBeNull();

    const res = await request(app).get(`/api/ubicaciones/${idSanJose}/hijos`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.map((c) => c.Nombre)).toContain('Escazú');
  });

  test('TC04 – Ubicación inexistente devuelve 404', async () => {
    const res = await request(app).get('/api/ubicaciones/999999999/hijos');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/ubicaciones/paises/:idPais/configuracion', () => {
  test('TC05 – Configuración de Costa Rica tiene 4 niveles (País, Provincia, Cantón, Distrito)', async () => {
    const idCostaRica = await buscarIdPorNombreYNivel('Costa Rica', 1, null);
    const res = await request(app).get(`/api/ubicaciones/paises/${idCostaRica}/configuracion`);
    expect(res.status).toBe(200);
    expect(res.body.niveles).toHaveLength(4);
    expect(res.body.niveles.map((n) => n.etiqueta)).toEqual(['País', 'Provincia', 'Cantón', 'Distrito']);
  });

  test('TC06 – Configuración de Estados Unidos tiene exactamente 3 niveles', async () => {
    const idEstadosUnidos = await buscarIdPorNombreYNivel('Estados Unidos', 1, null);
    const res = await request(app).get(`/api/ubicaciones/paises/${idEstadosUnidos}/configuracion`);
    expect(res.status).toBe(200);
    expect(res.body.niveles).toHaveLength(3);
    expect(res.body.niveles.map((n) => n.etiqueta)).toEqual(['País', 'Estado', 'Ciudad']);
  });

  test('TC07 – Configuración de Panamá tiene 4 niveles (incluye Corregimiento)', async () => {
    const idPanama = await buscarIdPorNombreYNivel('Panamá', 1, null);
    const res = await request(app).get(`/api/ubicaciones/paises/${idPanama}/configuracion`);
    expect(res.status).toBe(200);
    expect(res.body.niveles).toHaveLength(4);
    expect(res.body.niveles.map((n) => n.etiqueta)).toEqual(['País', 'Provincia o Comarca', 'Distrito', 'Corregimiento']);
  });

  test('TC08 – Configuración de una ubicación que no es país devuelve 404', async () => {
    const idCostaRica = await buscarIdPorNombreYNivel('Costa Rica', 1, null);
    const idSanJose = await buscarIdPorNombreYNivel('San José', 2, idCostaRica);
    const res = await request(app).get(`/api/ubicaciones/paises/${idSanJose}/configuracion`);
    expect(res.status).toBe(404);
  });
});

describe('validarCadenaUbicacion (validación de jerarquía)', () => {
  test('TC09 – Cadena completa y correcta de Costa Rica es válida', async () => {
    const idCostaRica = await buscarIdPorNombreYNivel('Costa Rica', 1, null);
    const idSanJoseProvincia = await buscarIdPorNombreYNivel('San José', 2, idCostaRica);
    const idSanJoseCanton = await buscarIdPorNombreYNivel('San José', 3, idSanJoseProvincia);
    const idCarmen = await buscarIdPorNombreYNivel('Carmen', 4, idSanJoseCanton);
    expect(idCarmen).not.toBeNull();

    const resultado = await ubicacionesService.validarCadenaUbicacion([
      idCostaRica, idSanJoseProvincia, idSanJoseCanton, idCarmen,
    ]);

    expect(resultado.valido).toBe(true);
    expect(resultado.nombres).toEqual(['Costa Rica', 'San José', 'San José', 'Carmen']);
  });

  test('TC10 – Cadena incompleta (se detiene antes del nivel más específico) es inválida', async () => {
    const idCostaRica = await buscarIdPorNombreYNivel('Costa Rica', 1, null);
    const idSanJoseProvincia = await buscarIdPorNombreYNivel('San José', 2, idCostaRica);
    const idSanJoseCanton = await buscarIdPorNombreYNivel('San José', 3, idSanJoseProvincia);

    const resultado = await ubicacionesService.validarCadenaUbicacion([
      idCostaRica, idSanJoseProvincia, idSanJoseCanton,
    ]);

    expect(resultado.valido).toBe(false);
  });

  test('TC11 – Rechaza un id que no pertenece al padre indicado', async () => {
    const idCostaRica = await buscarIdPorNombreYNivel('Costa Rica', 1, null);
    const idPanama = await buscarIdPorNombreYNivel('Panamá', 1, null);
    const idProvinciaPanama = await buscarIdPorNombreYNivel('Panamá', 2, idPanama);
    expect(idProvinciaPanama).not.toBeNull();

    // La provincia de Panamá no pertenece a Costa Rica.
    const resultado = await ubicacionesService.validarCadenaUbicacion([idCostaRica, idProvinciaPanama]);

    expect(resultado.valido).toBe(false);
    expect(resultado.motivo).toMatch(/no pertenece al padre/);
  });

  test('TC12 – Rechaza una cadena con un id inexistente', async () => {
    const resultado = await ubicacionesService.validarCadenaUbicacion([999999999]);
    expect(resultado.valido).toBe(false);
  });
});

describe('Seed de ubicaciones geográficas', () => {
  test('TC13 – Insertar el mismo nodo dos veces no duplica registros', async () => {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const nodoPrueba = { nombre: '__PaisPruebaSeed__', hijos: [{ nombre: '__ProvinciaPruebaSeed__' }] };

      await insertarArbol(transaction, nodoPrueba, 1, null);
      await insertarArbol(transaction, nodoPrueba, 1, null);

      const conteo = await new sql.Request(transaction)
        .input('nombre', sql.VarChar(150), '__PaisPruebaSeed__')
        .query('SELECT COUNT(*) AS total FROM UbicacionesGeograficas WHERE Nombre = @nombre AND Nivel = 1');

      expect(conteo.recordset[0].total).toBe(1);
    } finally {
      await transaction.rollback();
    }
  });
});
