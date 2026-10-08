const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeName, normalizeEmail, validatePassword, validateAdminCredentials } = require('../utils/adminCredentials');
const { createTerminalPrompt } = require('../utils/terminalPrompt');
const { collectCredentials } = require('../scripts/setupAdmin');
const { terminalFixture } = require('./helpers/terminal');
const valid = { name: 'Редактор', email: 'editor@example.org', password: 'secure-test-passphrase', confirmation: 'secure-test-passphrase' };

test('administrator validation normalizes name/email and rejects invalid credentials', () => {
  const { confirmation, ...normalized } = valid;
  assert.deepEqual(validateAdminCredentials({ ...valid, name: ' Редактор ', email: ' EDITOR@EXAMPLE.ORG ' }), normalized);
  for (const name of ['', ' '.repeat(5), 'x'.repeat(51), 'Имя\n']) {
    // A trailing line break is trimmed; an embedded control character is forbidden.
    if (name === 'Имя\n') assert.throws(() => normalizeName('Имя\nРедактор'));
    else assert.throws(() => normalizeName(name));
  }
  for (const email of ['', 'bad', 'a@localhost', 'a..b@example.org', '.a@example.org', 'a@-bad.org', 'a@b..org', 'a'.repeat(65)+'@example.org']) assert.throws(() => normalizeEmail(email));
  for (const password of ['', 'short', ' '.repeat(20), 'а'.repeat(37), 'word\n'.repeat(3)]) assert.throws(() => validatePassword(password));
  assert.throws(() => validateAdminCredentials({ ...valid, confirmation: 'different-passphrase' }), {code:'INVALID_ADMIN_INPUT'});
});

test('TTY password and confirmation are never echoed; raw mode is restored', {timeout:5000}, async () => {
  const tty = terminalFixture([valid.name, valid.email, valid.password, valid.confirmation]);
  const prompt = createTerminalPrompt(tty.input, tty.output);
  try {
    assert.deepEqual(await collectCredentials(prompt, tty.output), valid);
    assert.equal(tty.state.prompts, 4);
    assert.ok(tty.state.visible.includes('Имя администратора:'));
    assert.ok(tty.state.visible.includes('Повторите пароль'));
    assert.ok(!tty.state.visible.includes(valid.password));
  } finally { prompt.close(); }
  assert.equal(tty.input.isRaw, false);
});

test('invalid fields and mismatched confirmation are retried without exposing passwords', {timeout:5000}, async () => {
  const tty = terminalFixture(['', valid.name, 'invalid', valid.email, 'short', valid.password, 'does-not-match', valid.password, valid.password]);
  const prompt = createTerminalPrompt(tty.input, tty.output);
  try {
    assert.deepEqual(await collectCredentials(prompt, tty.output), valid);
    assert.ok(tty.state.visible.includes('Пароли не совпадают'));
    assert.ok(!tty.state.visible.includes(valid.password));
    assert.ok(!tty.state.visible.includes('does-not-match'));
  } finally { prompt.close(); }
});

test('non-interactive password input is rejected and Ctrl+C cancels cleanly', {timeout:5000}, async () => {
  assert.throws(() => createTerminalPrompt({ isTTY:false }, { isTTY:false }), {code:'TTY_REQUIRED'});
  const tty = terminalFixture([]);
  const prompt = createTerminalPrompt(tty.input, tty.output);
  await assert.rejects(prompt.ask('Имя администратора: '), {code:'SETUP_CANCELLED'});
  assert.equal(tty.input.isRaw, false);
  prompt.close();
});

test('Ctrl+C during password entry does not reveal partial secrets', {timeout:5000}, async () => {
  const tty = terminalFixture([{keys:'partial-secret\u0003'}]);
  const prompt = createTerminalPrompt(tty.input, tty.output);
  await assert.rejects(prompt.ask('Пароль (ввод скрыт): ', true), {code:'SETUP_CANCELLED'});
  assert.ok(!tty.state.visible.includes('partial-secret'));
  assert.equal(tty.input.isRaw, false);
  prompt.close();
});
