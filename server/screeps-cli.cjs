#! /usr/bin/env node
// @ts-ignore We can't load that from the outer non-Node 10 side
const repl = require('repl');
const q = require('q');
const net = require('net');
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
 * @param {string} [cmd]
 * @returns
 */
function cli(host, port, cmd = undefined) {

  const defer = q.defer();

  const socket = net.connect(port, host);
  /** @type {repl.REPLServer} */
  let rl;
  let connected = false;

  /**
   * Send a command to the server for execution
   * @param {string} input 
   */
  const executeCommand = (input) => {
    // The server side feeds the socket through `readline`, which splits on
    // newlines. To avoid breaking multi-line input into multiple commands,
    // we collapse internal newlines into spaces before sending.
    const toSend = input
      .replace(/\r?\n$/, '')   // drop the final newline REPL adds
      .replace(/\r?\n/g, ' '); // turn internal newlines into spaces

    socket.write(toSend + "\r\n");
  }

  /**
   * Evaluate the REPL input
   * @param {string} input
   * @param {vm.Context} context
   * @param {string} filename
   * @param {(err: Error | null, result?: any) => void} callback
   */
  const replEval = (input, context, filename, callback) => {
    try {
      // Using "vm.Script" lets use the V8 parser to check for syntax validity.
      new vm.Script(input, { filename });
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

    // At this point the input is complete JS. Pass the whole buffered input
    // to the socket, so multi-line constructs (like function definitions)
    // are already combined.
    executeCommand(input);
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

    if (cmd) {
      // Running in command mode, we're just gonna send the provided command,
      // wait for an answer and exit immediately.
      socket.on("data", data => {
        const string = data.toString('utf8');
        const cleaned = string.replace(/^< /, '').replace(/\n< /g, '\n');
        if (cleaned.match(/^Screeps server v.* running on port .*/)) {
          // Skip over server connection answer
          return;
        }

        process.stdout.write(cleaned);
        process.exit(1);
      });
      executeCommand(cmd);
      return;
    }

    defer.resolve();
    rl = repl.start({
      input: process.stdin,
      output: process.stdout,
      prompt: "> ",
      eval: replEval,
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

// Command line options and arguments
/** @type {string | undefined} */
let host = undefined;
/** @type {number | undefined} */
let port = undefined;
/** @type {string | undefined} */
let command = undefined;

// Janky option parsing
const argStart = process.argv.findIndex(arg => arg === __filename) + 1;
const ARGV = process.argv.slice(argStart);
while (ARGV.length) {
  if (ARGV[0][0] === "-") {
    if (ARGV[0] === "-c") {
      ARGV.shift()
      command = ARGV.shift();
    } else {
      console.error(`Unknown option ${ARGV[0]}`);
    }
  } else {
    if (host === undefined) {
      host = ARGV.shift();
    } else if (port === undefined) {
      const portStr = ARGV.shift();
      if (portStr === undefined) {
        console.error(`Missing port number ${portStr}`);
        process.exit(1);
      }
      const portNum = parseInt(portStr, 10);
      if (isNaN(portNum)) {
        console.error(`Invalid port number ${portStr}`);
        process.exit(1);
      }
      port = portNum;
    } else {
      console.error(`Unknown argument ${ARGV[0]}`);
      process.exit(1);
    }
  }
}

host = host || "localhost";
port = port || 21026;

cli(host, port, command);
