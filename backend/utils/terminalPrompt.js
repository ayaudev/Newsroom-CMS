const readline = require('node:readline');
const { Writable } = require('node:stream');

function createTerminalPrompt(input = process.stdin, output = process.stdout) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') {
    throw Object.assign(new Error('Запустите команду в интерактивном терминале. Перенаправление ввода и вывода запрещено для защиты пароля.'), { code: 'TTY_REQUIRED' });
  }
  let hidden = false;
  let closed = false;
  let rejectPending;
  const mutedOutput = new Writable({
    write(chunk, encoding, callback) {
      if (!hidden) output.write(chunk, encoding);
      callback();
    }
  });
  mutedOutput.isTTY = true;
  Object.defineProperty(mutedOutput, 'columns', { get: () => output.columns || 80 });
  const rl = readline.createInterface({ input, output: mutedOutput, terminal: true, historySize: 0, prompt: '' });
  const cancelled = () => Object.assign(new Error('Настройка отменена. Данные не сохранены.'), { code: 'SETUP_CANCELLED' });
  rl.on('close', () => {
    closed = true;
    if (rejectPending) rejectPending(cancelled());
    rejectPending = undefined;
    hidden = false;
  });
  rl.on('SIGINT', () => {
    output.write('\n');
    rl.close();
  });
  rl.on('error', () => rl.close());
  return {
    ask(message, secret = false) {
      if (closed) return Promise.reject(cancelled());
      hidden = secret;
      output.write(message);
      return new Promise((resolve, reject) => {
        rejectPending = reject;
        rl.question('', answer => {
          rejectPending = undefined;
          if (secret) output.write('\n');
          // Keep echo muted until readline has finished processing this line.
          resolve(answer);
        });
      });
    },
    close() { hidden = true; rl.close(); mutedOutput.end(); }
  };
}

module.exports = { createTerminalPrompt };
