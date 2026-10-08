require('dotenv').config();
const { pool } = require('../config/db');
const { assertInitialSetupAvailable, createInitialAdmin } = require('../services/adminSetup');
const { normalizeName, normalizeEmail, validatePassword } = require('../utils/adminCredentials');
const { createTerminalPrompt } = require('../utils/terminalPrompt');

async function collectCredentials(prompt, output) {
  async function field(message, validate) {
    while (true) {
      const value = await prompt.ask(message);
      try { return validate(value); }
      catch (error) { output.write(error.message + '\n'); }
    }
  }
  const name = await field('Имя администратора: ', normalizeName);
  const email = await field('Электронная почта: ', normalizeEmail);
  while (true) {
    const password = await prompt.ask('Пароль (ввод скрыт): ', true);
    try { validatePassword(password); }
    catch (error) { output.write(error.message + '\n'); continue; }
    const confirmation = await prompt.ask('Повторите пароль (ввод скрыт): ', true);
    if (password === confirmation) return { name, email, password, confirmation };
    output.write('Пароли не совпадают. Введите пароль заново.\n');
  }
}

async function runSetup({ input = process.stdin, output = process.stdout } = {}) {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('Укажите DATABASE_URL в backend/.env и выполните npm run migrate.'), { code: 'CONFIG_REQUIRED' });
  await assertInitialSetupAvailable();
  const prompt = createTerminalPrompt(input, output);
  try {
    output.write('Newsroom CMS — первоначальная настройка администратора\n');
    const credentials = await collectCredentials(prompt, output);
    prompt.close();
    const admin = await createInitialAdmin(credentials);
    output.write('Администратор создан. Войдите по указанной почте на странице /login.\n');
    return admin;
  } finally { prompt.close(); }
}

async function main() {
  try { await runSetup(); }
  catch (error) {
    const known = ['ADMIN_EXISTS', 'EMAIL_EXISTS', 'INVALID_ADMIN_INPUT', 'TTY_REQUIRED', 'SETUP_CANCELLED', 'CONFIG_REQUIRED'];
    console.error(known.includes(error.code) ? error.message : 'Не удалось завершить настройку. Проверьте соединение PostgreSQL и выполните npm run migrate.');
    process.exitCode = error.code === 'SETUP_CANCELLED' ? 130 : 1;
  } finally { await pool.end(); }
}

if (require.main === module) main();
module.exports = { runSetup, collectCredentials, main };
