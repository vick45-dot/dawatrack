const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dawatrack',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  // Cloud databases (Aiven, TiDB, etc.) require encrypted connections.
  // Set DB_SSL=true in the environment to enable it.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

module.exports = pool;
