const { PassThrough, Writable } = require('node:stream');

// TTY contract fixture: sends the same key events as an interactive terminal.
function terminalFixture(answers) {
  const input = new PassThrough();
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = state => { input.isRaw = state; };
  const state = { visible: '', prompts: 0 };
  const output = new Writable({
    write(chunk, encoding, callback) {
      const text = chunk.toString();
      state.visible += text;
      if (text.endsWith(': ')) {
        state.prompts += 1;
        const answer = answers.shift();
        setImmediate(() => input.write(answer === undefined ? '\u0003' : typeof answer === 'object' ? answer.keys : answer + '\r'));
      }
      callback();
    }
  });
  output.isTTY = true;
  output.columns = 80;
  return { input, output, state };
}
module.exports = { terminalFixture };
