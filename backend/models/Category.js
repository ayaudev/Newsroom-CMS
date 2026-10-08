const { query } = require('../config/db');
const { randomUUID } = require('crypto');
exports.list = async () => (await query(`SELECT c.id, c.slug AS "_id", c.slug, c.name, count(p.id)::int AS count FROM categories c LEFT JOIN posts p ON p.category_id=c.id AND p.status='published' GROUP BY c.id ORDER BY c.name`)).rows;
exports.create = async ({name,slug}) => (await query('INSERT INTO categories(id,name,slug) VALUES($1,$2,$3) RETURNING id,slug,name',[randomUUID(),name,slug])).rows[0];
exports.remove = async id => (await query('DELETE FROM categories WHERE id=$1 RETURNING id',[id])).rowCount;
