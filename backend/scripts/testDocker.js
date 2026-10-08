const { randomUUID, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  // Refuse the application database or any host PostgreSQL instance.
  if (process.env.PGHOST !== 'postgres-test' || process.env.PGDATABASE !== 'postgres' || process.env.DATABASE_URL) {
    throw new Error('Тесты разрешены только в сервисе postgres-test');
  }
  const { pool } = require('../config/db');
  try {
    const name = 'newsroom_test_' + randomUUID().replaceAll('-', '');
    await pool.query('CREATE DATABASE ' + name);
    const connection = new URL('postgresql://postgres-test:5432/' + name);
    connection.username = process.env.PGUSER;
    connection.password = process.env.PGPASSWORD;
    const files = (await fs.readdir(path.join(__dirname, '../tests'))).filter(file => file.endsWith('.test.js')).map(file => 'tests/' + file);
    const child = spawn(process.execPath, ['--test', ...files], {
      cwd: path.join(__dirname, '..'), stdio: 'inherit',
      env: { ...process.env, PGDATABASE: name, DATABASE_URL: connection.toString(),
        JWT_SECRET: randomBytes(32).toString('hex'), NEWSROOM_INTEGRATION: '1' }
    });
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
    process.exitCode = code === 0 ? 0 : 1;
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
