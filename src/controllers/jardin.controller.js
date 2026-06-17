const { getConnection, sql } = require('../config/db');

function parsearDiasRiego(frecuencia) {
    if (!frecuencia) return 7;
    const match = frecuencia.match(/(\d+)/);
    return match ? parseInt(match[1]) : 7;
}

async function obtenerJardin(req, res) {
    const { idUsuario } = req.params;
    try {
        const pool = await getConnection();
        const resultado = await pool.request()
            .input('idUsuario', sql.Int, idUsuario)
            .query(`
                SELECT
                    jv.IdJardin,
                    jv.NombrePersonalizado,
                    jv.EstadoPlanta,
                    jv.FechaAdquisicion,
                    p.IdProducto,
                    p.Nombre,
                    p.Imagen,
                    pl.FrecuenciaRiego,
                    DATEDIFF(day, CAST(GETDATE() AS DATE), (
                        SELECT TOP 1 cp.FechaProgramada
                        FROM CuidadosPlantas cp
                        WHERE cp.IdJardin = jv.IdJardin
                          AND cp.TipoCuidado = 'Riego'
                          AND cp.Realizado = 0
                        ORDER BY cp.FechaProgramada ASC
                    )) AS DiasParaRiego
                FROM JardinVirtual jv
                INNER JOIN Plantas pl ON jv.IdPlanta = pl.IdPlanta
                INNER JOIN Productos p ON pl.IdProducto = p.IdProducto
                WHERE jv.IdUsuario = @idUsuario
                ORDER BY jv.FechaAdquisicion DESC
            `);

        const plantas = resultado.recordset.map(row => ({
            IdJardin: row.IdJardin,
            IdProducto: row.IdProducto,
            Nombre: row.Nombre,
            NombrePersonalizado: row.NombrePersonalizado,
            Imagen: row.Imagen,
            EstadoPlanta: row.EstadoPlanta,
            FrecuenciaRiego: row.FrecuenciaRiego,
            DiasParaRiego: row.DiasParaRiego,
        }));

        res.json({ success: true, plantas });
    } catch (error) {
        console.error('Error al obtener jardín:', error);
        res.status(500).json({ success: false, message: 'Error al obtener el jardín' });
    }
}

async function agregarPlanta(req, res) {
    const { idUsuario } = req.params;
    const { idProducto, nombrePersonalizado } = req.body;

    try {
        const pool = await getConnection();

        const plantaResult = await pool.request()
            .input('idProducto', sql.Int, idProducto)
            .query(`SELECT IdPlanta, FrecuenciaRiego FROM Plantas WHERE IdProducto = @idProducto`);

        if (plantaResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Planta no encontrada' });
        }

        const { IdPlanta, FrecuenciaRiego } = plantaResult.recordset[0];

        const existeResult = await pool.request()
            .input('idUsuario', sql.Int, idUsuario)
            .input('idPlanta', sql.Int, IdPlanta)
            .query(`SELECT IdJardin FROM JardinVirtual WHERE IdUsuario = @idUsuario AND IdPlanta = @idPlanta`);

        if (existeResult.recordset.length > 0) {
            return res.json({ success: true, yaExiste: true, idJardin: existeResult.recordset[0].IdJardin });
        }

        const insertResult = await pool.request()
            .input('idUsuario', sql.Int, idUsuario)
            .input('idPlanta', sql.Int, IdPlanta)
            .input('nombrePersonalizado', sql.NVarChar(100), nombrePersonalizado ?? null)
            .query(`
                INSERT INTO JardinVirtual (IdUsuario, IdPlanta, NombrePersonalizado, FechaAdquisicion, EstadoPlanta)
                OUTPUT INSERTED.IdJardin
                VALUES (@idUsuario, @idPlanta, @nombrePersonalizado, CAST(GETDATE() AS DATE), 'Saludable')
            `);

        const idJardin = insertResult.recordset[0].IdJardin;

        const diasRiego = parsearDiasRiego(FrecuenciaRiego);
        await pool.request()
            .input('idJardin', sql.Int, idJardin)
            .input('diasRiego', sql.Int, diasRiego)
            .query(`
                INSERT INTO CuidadosPlantas (IdJardin, TipoCuidado, FechaProgramada, Realizado)
                VALUES (@idJardin, 'Riego', DATEADD(day, @diasRiego, CAST(GETDATE() AS DATE)), 0)
            `);

        res.json({ success: true, yaExiste: false, idJardin });
    } catch (error) {
        console.error('Error al agregar planta al jardín:', error);
        res.status(500).json({ success: false, message: 'Error al agregar la planta al jardín' });
    }
}

async function eliminarPlanta(req, res) {
    const { idJardin } = req.params;

    try {
        const pool = await getConnection();

        await pool.request()
            .input('idJardin', sql.Int, idJardin)
            .query(`DELETE FROM CuidadosPlantas WHERE IdJardin = @idJardin`);

        await pool.request()
            .input('idJardin', sql.Int, idJardin)
            .query(`DELETE FROM JardinVirtual WHERE IdJardin = @idJardin`);

        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar planta del jardín:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar la planta del jardín' });
    }
}

module.exports = { obtenerJardin, agregarPlanta, eliminarPlanta };
