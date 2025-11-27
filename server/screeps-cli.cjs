#! /usr/bin/env node
// @ts-ignore We can't load that from the outer non-Node 10 side
const repl = require("repl");
const q = require('q');
const net = require("net");
const path = require('path');
const os = require('os');
const fs = require('fs');
const vm = require('vm');
const readline = require('readline');

const HISTORY_FILE = (() => {
  const filePath = process.env.CLI_HISTORY_FILE;
  if (filePath) {
    if (path.isAbsolute(filePath)) {
      return filePath;
    } else {
      return path.normalize(path.join(os.homedir(), filePath));
    }
  }
  return path.join(os.homedir(), '.screeps-history');
})();

/**
 * @param {string} host
 * @param {number} port
 * @returns
 */
function cli(host, port) {

  const defer = q.defer();

  const socket = net.connect(port, host);
  /** @type {repl.REPLServer} */
  let rl;
  let connected = false;

  /**
   * Evaluate the REPL command
   * @param {string} cmd
   * @param {vm.Context} context
   * @param {string} filename
   * @param {(err: Error | null, result?: any) => void} callback
   */
  const rplEval = (cmd, context, filename, callback) => {
    try {
      // Using "vm.Script" lets use the V8 parser to check for syntax validity.
      new vm.Script(cmd, { filename });
    } catch (err) {
      if (!(err instanceof Error)) {
        console.error('Unexpected error from repl eval', err);
        process.exit(1);
        return;
      }
      if (isRecoverableError(err)) {
        return callback(new repl.Recoverable(err));
      }
      return callback(err);
    }

    // At this point the input is complete JS. REPL passes the whole buffered
    // input as `cmd`, so multi-line constructs (like function definitions)
    // are already combined.
    // However the server side feeds the socket through `readline`, which splits
    // on newlines. To avoid breaking multi-line input into multiple commands, we
    // collapse internal newlines into spaces before sending.
    const toSend = cmd
      .replace(/\r?\n$/, '')   // drop the final newline REPL adds
      .replace(/\r?\n/g, ' '); // turn internal newlines into spaces

    socket.write(toSend + "\r\n");
    callback(null);
  };

  /**
   * Decide whether a syntax error is recoverable (i.e. REPL should keep
   * accepting more input instead of erroring immediately).
   *
   * @param {Error} error
   * @returns {boolean}
   */
  function isRecoverableError(error) {
    if (error.name === 'SyntaxError') {
      return /^(Unexpected end of input|Unexpected token)/.test(error.message);
    }
    return false;
  }

  socket.on('connect', () => {
    connected = true;
    defer.resolve();
    rl = repl.start({
      input: process.stdin,
      output: process.stdout,
      prompt: "> ",
      eval: rplEval,
    });

    try {
      // @ts-expect-error I'm guessing this is a private ivar of REPL?
      rl.history = JSON.parse(fs.readFileSync(HISTORY_FILE).toString('utf8'));
    } catch (err) {}

    rl.on('close', () => {
      // @ts-expect-error I'm guessing this is a private ivar of REPL?
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(rl.history));
      socket.end();
    });

    rl.on('exit', () => {
      rl.output.write(`Disconnecting…\r\n`);
      socket.end();
    });

    rl.output.write(`Screeps CLI connected on ${host}:${port}.\r\n-----------------------------------------\r\n`);
  });

  socket.on('data', (data) => {
    if (!rl) return;
    const string = data.toString('utf8');
    const cleaned = string.replace(/^< /, '').replace(/\n< /g, '\n');

    // Clear the current input line (prompt + user-typed text),
    // print the server output, then redraw the prompt and buffer so
    // asynchronous logs don't interleave with what the user is typing.
    readline.clearLine(rl.output, 0);
    readline.cursorTo(rl.output, 0);
    rl.output.write(cleaned);
    if (!/\n$/.test(cleaned)) {
      rl.output.write('\n');
    }
    rl.displayPrompt(true);
  });
  
  socket.on('error', (error) => {
    if (!connected) {
      console.error(`Failed to connect to ${host}:${port}: ${error.message}`);
    } else {
      console.error(`Socket error: ${error.message}`);
    }
    defer.reject(error);
    process.exit(1);
  });

  socket.on('close', () => {
    if (rl) {
      rl.close();
    }
    process.exit(0);
  });
  
  return defer.promise;
};

cli("localhost", 21026);
