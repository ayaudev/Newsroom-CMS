const { query } = require('../config/db');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const fields = 'id AS "_id", id, name, email, role, avatar, created_at AS "createdAt"';
exports.findById = async id => (await query('SELECT '+fields+' FROM users WHERE id=$1',[id])).rows[0];
exports.findByEmail = async email => (await query('SELECT '+fields+', password FROM users WHERE email=$1',[String(email).trim().toLowerCase()])).rows[0];
exports.create = async ({name,email,password,role='user'}) => (await query('INSERT INTO users(id,name,email,password,role) VALUES($1,$2,$3,$4,$5) RETURNING '+fields,[randomUUID(),name.trim(),email.trim().toLowerCase(),await bcrypt.hash(password,12),role])).rows[0];
exports.update = async (id,{name,avatar}) => (await query('UPDATE users SET name=COALESCE($2,name), avatar=COALESCE($3,avatar) WHERE id=$1 RETURNING '+fields,[id,name?.trim(),avatar])).rows[0];
exports.changePassword = async (id,password) => query('UPDATE users SET password=$2 WHERE id=$1',[id,await bcrypt.hash(password,12)]);
