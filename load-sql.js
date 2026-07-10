// Runs a .sql file against a remote MySQL (e.g. Aiven), or verifies the setup.
// Works where the XAMPP mysql.exe client fails (missing caching_sha2_password).
//
// Usage (Windows cmd, in the project folder):
//   set AIVEN_HOST=your-host.aivencloud.com
//   set AIVEN_PORT=22615
//   set AIVEN_USER=avnadmin
//   set AIVEN_PASSWORD=your-password
//   node load-sql.js sql\schema.sql
//   node load-sql.js sql\seed.sql
//   node load-sql.js sql\upgrade.sql
//   node load-sql.js --verify

const fs = require('fs');
const mysql = require('mysql2/promise');

const cfg = {
  host: process.env.AIVEN_HOST,
  port: Number(process.env.AIVEN_PORT) || 3306,
  user: process.env.AIVEN_USER || 'avnadmin',
  password: process.env.AIVEN_PASSWORD,
  multipleStatements: true,
  ssl: process.env.AIVEN_SSL === 'false' ? undefined : { rejectUnauthorized: false },
};

(async () => {
  if (!cfg.host || !cfg.password) {
    console.error('Missing settings. First run:');
    console.error('  set AIVEN_HOST=...   set AIVEN_PORT=...   set AIVEN_PASSWORD=...');
    process.exit(1);
  }

  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node load-sql.js <file.sql>   or   node load-sql.js --verify');
    process.exit(1);
  }

  const conn = await mysql.createConnection(cfg);
  try {
    if (target === '--verify') {
      const [tables] = await conn.query('SHOW TABLES FROM dawatrack');
      console.log('Tables in dawatrack:', tables.map(r => Object.values(r)[0]).join(', ') || '(none)');
      const [users] = await conn.query('SELECT username, role FROM dawatrack.users');
      console.log('Users:', users.map(u => `${u.username} (${u.role})`).join(', ') || '(none)');
      const [[c]] = await conn.query(
        'SELECT (SELECT COUNT(*) FROM dawatrack.products) AS products, (SELECT COUNT(*) FROM dawatrack.purchases) AS purchases, (SELECT COUNT(*) FROM dawatrack.sales) AS sales'
      );
      console.log(`Rows: products=${c.products} purchases=${c.purchases} sales=${c.sales}`);
    } else {
      const sql = fs.readFileSync(target, 'utf8');
      console.log(`Running ${target} against ${cfg.host} ...`);
      await conn.query(sql);
      console.log('Done - no errors.');
    }
  } finally {
    await conn.end();
  }
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
