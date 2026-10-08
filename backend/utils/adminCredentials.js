const { domainToASCII } = require('node:url');

function validationError(message) {
  return Object.assign(new Error(message), { code: 'INVALID_ADMIN_INPUT' });
}

function normalizeName(value) {
  if (typeof value !== 'string') throw validationError('Укажите имя администратора.');
  const name = value.trim();
  if (!name || name.length > 50 || /[\p{Cc}\p{Cf}]/u.test(name)) {
    throw validationError('Имя должно содержать от 1 до 50 символов без управляющих символов.');
  }
  return name;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') throw validationError('Укажите корректную электронную почту.');
  const email = value.trim().toLowerCase();
  const parts = email.split('@');
  const local = parts[0];
  const domain = parts.length === 2 ? domainToASCII(parts[1]) : '';
  const labels = domain.split('.');
  if (email.length > 254 || !local || local.length > 64 ||
      !/^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+$/i.test(local) ||
      local.startsWith('.') || local.endsWith('.') || local.includes('..') ||
      labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
    throw validationError('Укажите корректную электронную почту, например editor@example.org.');
  }
  return local + '@' + domain;
}

function validatePassword(password) {
  if (typeof password !== 'string' || Array.from(password).length < 12 ||
      Buffer.byteLength(password, 'utf8') > 72 || !password.trim() || /[\p{Cc}\p{Cf}]/u.test(password)) {
    throw validationError('Пароль: минимум 12 символов, максимум 72 байта UTF-8, без управляющих символов.');
  }
  return password;
}

function validateAdminCredentials({ name, email, password, confirmation } = {}) {
  const result = { name: normalizeName(name), email: normalizeEmail(email), password: validatePassword(password) };
  if (password !== confirmation) throw validationError('Пароли не совпадают.');
  return result;
}

module.exports = { normalizeName, normalizeEmail, validatePassword, validateAdminCredentials };
