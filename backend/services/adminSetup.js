const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');
const { query, transaction } = require('../config/db');
const { validateAdminCredentials } = require('../utils/adminCredentials');

const existsError = () => Object.assign(new Error('Администратор уже существует. Первоначальная настройка недоступна.'), { code: 'ADMIN_EXISTS' });

async function assertInitialSetupAvailable() {
  const result = await query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
  if (result.rowCount) throw existsError();
}

async function createInitialAdmin(input) {
  const { name, email, password } = validateAdminCredentials(input);
  const hash = await bcrypt.hash(password, 12);
  return transaction(async client => {
    // Also serializes setup against ordinary registrations and other admin inserts.
    await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    if ((await client.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1")).rowCount) throw existsError();
    if ((await client.query('SELECT 1 FROM users WHERE email = $1', [email])).rowCount) {
      throw Object.assign(new Error('Эта электронная почта уже зарегистрирована. Выберите другую.'), { code: 'EMAIL_EXISTS' });
    }
    const result = await client.query(
      'INSERT INTO users(id, name, email, password, role) VALUES($1,$2,$3,$4,$5) RETURNING id, name, email, role',
      [randomUUID(), name, email, hash, 'admin']
    );
    return result.rows[0];
  });
}

module.exports = { assertInitialSetupAvailable, createInitialAdmin };
