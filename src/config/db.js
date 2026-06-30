const sql = require('mssql');

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: Number(process.env.DB_PORT),
  connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 30000,
  requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT_MS) || 30000,
  pool: {
    max: Number(process.env.DB_POOL_MAX) || 10,
    min: Number(process.env.DB_POOL_MIN) || 0,
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS) || 30000,
  },
  options: {
    encrypt: process.env.DB_ENCRYPT ? process.env.DB_ENCRYPT === 'true' : true,
    trustServerCertificate: process.env.DB_TRUST_CERT ? process.env.DB_TRUST_CERT === 'true' : true
  }
};

async function getConnection() {
  try {
    const pool = await sql.connect(dbConfig);
    return pool;
  } catch (error) {
    console.error('Error conectando a SQL Server:', {
      message: error.message,
      code: error.code,
      name: error.name,
      server: dbConfig.server,
      port: dbConfig.port,
      database: dbConfig.database,
      connectionTimeout: dbConfig.connectionTimeout,
    });
    throw error;
  }
}

module.exports = {
  sql,
  getConnection
};
