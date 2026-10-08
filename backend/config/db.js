const { Pool } = require('pg');
// Local development keeps DATABASE_URL; Docker uses native PG* environment variables.
const hasDatabaseConfiguration = () => Boolean(process.env.DATABASE_URL ||
  (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD));
const pool = new Pool({ connectionString: process.env.DATABASE_URL || undefined });
pool.on('error', error => console.error('Ошибка подключения PostgreSQL:', error.message));
const query = (text, values) => pool.query(text, values);
async function transaction(fn) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
module.exports = { pool, query, transaction, hasDatabaseConfiguration };
