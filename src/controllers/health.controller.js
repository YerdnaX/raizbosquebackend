const { getConnection } = require('../config/db');

async function checkDb(req, res) {
  try {
    const pool = await getConnection();
    await pool.request().query('SELECT 1 AS ok');
    res.json({ success: true, message: 'Conexión con SQL Server exitosa' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error conectando con SQL Server' });
  }
}

module.exports = { checkDb };
