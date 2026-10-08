require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { pool, transaction } = require('../config/db');
const categories = { politics:'Политика', business:'Экономика', technology:'Технологии', sports:'Спорт', entertainment:'Культура', health:'Здоровье', science:'Наука', world:'Мир', local:'Кампус' };
async function migrate() {
 await transaction(async client => {
  await client.query('SELECT pg_advisory_xact_lock(20261008, 2)');
  await client.query(await fs.readFile(path.join(__dirname,'schema.sql'),'utf8'));
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const migrationName = '002_article_submissions';
  if (!(await client.query('SELECT 1 FROM schema_migrations WHERE name=$1',[migrationName])).rowCount) {
   await client.query(await fs.readFile(path.join(__dirname,'migrations/002_article_submissions.sql'),'utf8'));
   await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[migrationName]);
  }
  for (const [slug,name] of Object.entries(categories)) await client.query('INSERT INTO categories(id,slug,name) VALUES($1,$2,$3) ON CONFLICT(slug) DO NOTHING',[randomUUID(),slug,name]);
 });
}
if(require.main === module) migrate().then(()=>console.log('Схема PostgreSQL готова')).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
module.exports = migrate;
