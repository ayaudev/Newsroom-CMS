require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { pool, transaction } = require('../config/db');
const categories = { politics:'Политика', business:'Экономика', technology:'Технологии', sports:'Спорт', entertainment:'Культура', health:'Здоровье', science:'Наука', world:'Мир', local:'Кампус' };
async function migrate() {
 await transaction(async client => {
  await client.query(await fs.readFile(path.join(__dirname,'schema.sql'),'utf8'));
  for (const [slug,name] of Object.entries(categories)) await client.query('INSERT INTO categories(id,slug,name) VALUES($1,$2,$3) ON CONFLICT(slug) DO NOTHING',[randomUUID(),slug,name]);
 });
}
if(require.main === module) migrate().then(()=>console.log('Схема PostgreSQL готова')).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
module.exports = migrate;
