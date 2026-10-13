// Conexión a Azure SQL (SQL Server en la nube) con un pool reutilizable.
// Los datos de conexión NO van en el código: se leen de las Variables de entorno de Vercel.
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,          // ej: sql-isaura-bigdata.database.windows.net
  database: process.env.DB_NAME,          // ej: SistemaVentas
  user: process.env.DB_USER,              // ej: adminisaura
  password: process.env.DB_PASSWORD,
  port: 1433,
  options: { encrypt: true, trustServerCertificate: false },
  // La base gratuita se pausa sola; al "despertar" puede tardar, por eso tiempos amplios.
  connectionTimeout: 60000,
  requestTimeout: 30000,
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 }
};

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch(err => {
      poolPromise = null;          // si falla, el siguiente intento vuelve a conectar
      throw err;
    });
  }
  return poolPromise;
}

module.exports = { sql, getPool };
