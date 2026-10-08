const { pool, hasDatabaseConfiguration } = require('../config/db');
const migrate = require('../db/migrate');
const { start } = require('../server');
async function main() {
  if (!hasDatabaseConfiguration() || !process.env.JWT_SECRET) {
    throw new Error('Укажите параметры PostgreSQL и JWT_SECRET в корневом .env');
  }
  await migrate();
  console.log('Newsroom CMS: безопасные миграции применены');
  await start();
}
main().catch(async error => {
  console.error(error.message);
  await pool.end();
  process.exitCode = 1;
});
