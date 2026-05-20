#!/usr/bin/env node
/**
 * Backup / restore MongoDB + Redis for screeps-server using host Docker (compose).
 * Expects the repo at WORKSPACE_DIR (e.g. /workspace in the backup-tool container). Nested `docker compose`
 * bind mounts must use a host-side repo path (`HOST_WORKSPACE` or inferred from the `/workspace` mount), not paths only valid inside the tool container.
 */
import { execFileSync, spawn } from "node:child_process";
import { createReadStream, readFileSync, promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stderr } from "node:process";
import { parseArgs } from "node:util";

/** @typedef {import("node:child_process").SpawnOptions} SpawnOptions */

/** Project root inside this process (compose file, mkdir, fs); in the backup-tool container this is /workspace. */
const ROOT = process.env.WORKSPACE_DIR ?? process.cwd();

/**
 * Host repo path for nested `docker … -v <host>:…` bind mounts (the daemon resolves `<host>` on the host).
 * Uses `HOST_WORKSPACE` when set; otherwise, if this process sees `/workspace` as ROOT, asks the Docker
 * API for the source path of the `/workspace` mount (works when `$PWD` is unset for Compose, e.g. CI).
 * @returns {string}
 */
function resolveHostRoot() {
  const raw = process.env.HOST_WORKSPACE?.trim();
  if (raw) return path.resolve(raw);
  if (path.resolve(ROOT) !== path.resolve("/workspace")) return ROOT;
  const id = (process.env.HOSTNAME ?? "").trim() || readHostnameFile();
  if (!id) return ROOT;
  try {
    const src = execFileSync(
      "docker",
      [
        "inspect",
        "-f",
        '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}',
        id,
      ],
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    ).trim();
    if (src) return path.resolve(src);
  } catch {
    /* no socket, wrong id, etc. */
  }
  return ROOT;
}

/** @returns {string} */
function readHostnameFile() {
  try {
    return readFileSync("/etc/hostname", "utf8").trim();
  } catch {
    return "";
  }
}

const HOST_ROOT = resolveHostRoot();

/** @param {...string} segments Path segments under the repo (e.g. "backups"). */
function hostBindPath(...segments) {
  return path.join(HOST_ROOT, ...segments).replace(/\\/g, "/");
}

/** 0 = quiet, 1 = -v, 2 = -vv */
let verbose = 0;

/**
 * @param {number} [status]
 * @returns {never}
 */
function usage(status = 1) {
  stderr.write(
    "usage: database.js backup [prefix] | restore <prefix>\n  options: -h|--help  -v|-vv|--verbose|--verbose=N\n",
  );
  process.exit(status);
  throw new Error("unreachable");
}

/**
 * @param {string | number | boolean} s
 * @returns {string}
 */
function shQuote(s) {
  const str = String(s);
  if (!/[^\w@%+=:,./-]/.test(str)) return str;
  return `'${str.replace(/'/g, `'\\''`)}'`;
}

/** @param {string} cmd @param {string[]} args */
function logCmd(cmd, args) {
  if (verbose >= 1) {
    stderr.write(`+ ${cmd} ${args.map(shQuote).join(" ")}\n`);
  }
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {SpawnOptions} [options]
 * @returns {Promise<void>}
 */
function spawnAsync(cmd, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...process.env, ...options?.env },
      ...options,
    });
    child.on("error", reject);
    child.on(
      "close",
      (/** @type {number | null} */ code, /** @type {NodeJS.Signals | null} */ signal) => {
        if (code === 0) resolve();
        else reject(new Error(`${cmd} exited ${code}${signal ? ` (${signal})` : ""}`));
      },
    );
  });
}

/**
 * Quiet: stdin ignored for nested `docker` (avoids broken stdin under `compose run`); stderr captured unless `-vv`.
 * @param {string} cmd
 * @param {string[]} args
 * @param {SpawnOptions} [opts]
 * @returns {Promise<void>}
 */
async function run(cmd, args, opts = {}) {
  logCmd(cmd, args);
  if (verbose >= 2) {
    await spawnAsync(cmd, args, {
      stdio: ["ignore", "inherit", "inherit"],
      cwd: ROOT,
      env: process.env,
    });
    return;
  }
  const stdio = opts.stdio ?? /** @type {const} */ (["ignore", "inherit", "pipe"]);
  await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: process.env,
      stdio,
    });
    let errBuf = "";
    if (child.stderr)
      child.stderr.on("data", (/** @type {Buffer | string} */ d) => (errBuf += d.toString()));
    child.on("error", reject);
    child.on("close", (/** @type {number | null} */ code) => {
      if (code === 0) resolve(undefined);
      else {
        stderr.write(errBuf);
        reject(new Error(`${cmd} exited ${code}`));
      }
    });
  });
}

/**
 * Run command and return combined stdout (trimmed by callers as needed).
 * @param {string} cmd
 * @param {string[]} args
 * @returns {Promise<string>}
 */
async function runCapture(cmd, args) {
  logCmd(cmd, args);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout?.on("data", (/** @type {Buffer | string} */ d) => {
      const s = d.toString();
      out += s;
      if (verbose >= 2) stderr.write(s);
    });
    child.stderr?.on("data", (/** @type {Buffer | string} */ d) => {
      const s = d.toString();
      err += s;
      if (verbose >= 2) stderr.write(s);
    });
    child.on("error", reject);
    child.on("close", (/** @type {number | null} */ code) => {
      if (code === 0) resolve(out);
      else {
        if (verbose < 2) stderr.write(err);
        reject(new Error(`${cmd} exited ${code}`));
      }
    });
  });
}

/**
 * @param {string[]} args Arguments after `docker compose`
 * @param {SpawnOptions} [opts]
 * @returns {Promise<void>}
 */
async function dockerCompose(args, opts) {
  await run("docker", ["compose", ...args], opts);
}

/**
 * @param {string[]} args
 * @returns {Promise<string>}
 */
async function dockerComposeCapture(args) {
  return (await runCapture("docker", ["compose", ...args])).trim();
}

/**
 * @param {string} raw User-provided prefix or path fragment
 * @returns {string}
 */
function normalizePrefix(raw) {
  let p = String(raw).replace(/^\.\//, "");
  p = p.replace(/^backups\//, "");
  p = path.basename(p);
  p = p.replace(/\.mongo\.archive$/i, "").replace(/\.redis\.rdb$/i, "");
  if (!p) throw new Error("invalid prefix");
  if (p.includes("..") || p.includes("/") || p.includes("\\")) throw new Error("invalid prefix");
  return p;
}

/** @returns {string} Local timestamp prefix YYYYMMDD-HHMMSS */
function timestampPrefix() {
  const d = new Date();
  /** @param {number} n */
  const z = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-` +
    `${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`
  );
}

/** @returns {Promise<boolean>} */
async function screepsContainerRunning() {
  try {
    const out = await dockerComposeCapture([
      "ps",
      "-q",
      "--status",
      "running",
      "screeps",
    ]);
    return out.length > 0;
  } catch {
    return false;
  }
}

/**
 * Whether restored Redis should materialize AOF (appendonly yes).
 * @returns {Promise<boolean>}
 */
async function redisUsesAppendonly() {
  try {
    const runningId = await dockerComposeCapture([
      "ps",
      "-q",
      "--status",
      "running",
      "redis",
    ]);
    if (runningId) {
      const line = await runCapture("docker", [
        "compose",
        "exec",
        "-T",
        "redis",
        "redis-cli",
        "CONFIG",
        "GET",
        "appendonly",
      ]);
      const v = line.split(/\r?\n/).filter(Boolean).pop()?.trim();
      return v === "yes";
    }
  } catch {
    /* fall through */
  }
  try {
    const ids = await dockerComposeCapture(["ps", "-aq", "redis"]);
    const cid = ids.split(/\r?\n/).filter(Boolean)[0];
    if (cid) {
      const json = await runCapture("docker", [
        "inspect",
        "-f",
        "{{json .Config.Cmd}}",
        cid,
      ]);
      return json.includes("appendonly") && json.includes("yes");
    }
  } catch {
    /* fall through */
  }
  stderr.write(
    "Could not infer whether this stack uses Redis AOF (no running or existing redis container).\n",
  );
  /** @type {import("node:fs").ReadStream | typeof input} */
  let rlInput = input;
  try {
    if (!input.isTTY) rlInput = createReadStream("/dev/tty");
  } catch {
    /* keep stdin */
  }
  const rl = readline.createInterface({ input: rlInput, output: stderr });
  try {
    const ans = await rl.question(
      "Materialize AOF on disk after RDB restore (appendonly yes)? [y/N] ",
    );
    const a = ans.trim().toLowerCase();
    return a === "y" || a === "yes";
  } finally {
    rl.close();
  }
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** One-off Redis: load RDB with AOF off, enable AOF, shutdown. Caller starts service redis. */
async function redisRebuildAof() {
  const ridRaw = await runCapture("docker", [
    "compose",
    "run",
    "-T",
    "-d",
    "--no-deps",
    "redis",
    "redis-server",
    "--appendonly",
    "no",
    "--save",
    "3600",
    "1",
    "--save",
    "300",
    "100",
    "--save",
    "60",
    "10000",
  ]);
  const rid = ridRaw.replace(/\r/g, "").replace(/\s+/g, "").trim();
  if (!rid) {
    stderr.write("redis restore: docker compose run failed (no container id)\n");
    process.exit(1);
  }
  for (let i = 0; i < 120; i++) {
    try {
      const pong = await runCapture("docker", ["exec", rid, "redis-cli", "ping"]);
      if (pong.includes("PONG")) break;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  try {
    const pong = await runCapture("docker", ["exec", rid, "redis-cli", "ping"]);
    if (!pong.includes("PONG")) throw new Error("no PONG");
  } catch {
    stderr.write("redis restore: one-off container did not respond to PING\n");
    try {
      await run("docker", ["rm", "-f", rid]);
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
  await run("docker", ["exec", rid, "redis-cli", "CONFIG", "SET", "appendonly", "yes"]);
  try {
    await run("docker", ["exec", rid, "redis-cli", "BGREWRITEAOF"]);
  } catch {
    /* optional */
  }
  const settle = parseInt(process.env.REDIS_RESTORE_AOF_SETTLE_SECONDS ?? "4", 10) * 1000;
  await sleep(Number.isFinite(settle) ? settle : 4000);
  try {
    await run("docker", ["exec", rid, "redis-cli", "SHUTDOWN", "SAVE"]);
  } catch {
    try {
      await run("docker", ["stop", rid]);
    } catch {
      /* ignore */
    }
  }
  try {
    await run("docker", ["rm", "-f", rid]);
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} prefix
 * @returns {Promise<void>}
 */
async function restoreMongodbFromPrefix(prefix) {
  stderr.write("Restoring MongoDB...\n");
  await dockerCompose([
    "run",
    "-T",
    "--rm",
    "--no-deps",
    "-v",
    `${hostBindPath("backups")}:/backup:ro`,
    "--entrypoint",
    "mongorestore",
    "mongo",
    "--uri=mongodb://mongo:27017",
    "--gzip",
    "--quiet",
    "--drop",
    `--archive=/backup/${prefix}.mongo.archive`,
  ]);
}

/**
 * @param {string} prefix
 * @returns {Promise<void>}
 */
async function restoreRedisVolumeFromPrefix(prefix) {
  stderr.write("Restoring Redis data directory...\n");
  const sh = [
    "set -e;",
    "rm -rf /data/appendonlydir /data/temp-appendonlydir;",
    "rm -f /data/appendonly.aof /data/appendonly.aof.manifest /data/appendonly.aof.rdb;",
    `cp /backup/${prefix}.redis.rdb /data/dump.rdb;`,
    "chown redis:redis /data/dump.rdb",
  ].join(" ");
  await dockerCompose([
    "run",
    "-T",
    "--rm",
    "--no-deps",
    "--user",
    "root",
    "-v",
    `${hostBindPath("backups")}:/backup:ro`,
    "--entrypoint",
    "/bin/sh",
    "redis",
    "-c",
    sh,
  ]);
}

/**
 * @param {string[]} args Remaining argv after `backup`
 * @returns {Promise<void>}
 */
async function cmdBackup(args) {
  if (args.length > 1) usage(1);
  /** @type {string} */
  let prefix;
  if (args.length === 1) {
    if (args[0].startsWith("-")) usage(1);
    prefix = normalizePrefix(args[0]);
  } else {
    prefix = timestampPrefix();
  }

  let didPause = false;
  /** @type {null | (() => Promise<void>)} */
  let cleanupResume = null;
  if (await screepsContainerRunning()) {
    cleanupResume = async () => {
      stderr.write("Resuming simulation...\n");
      try {
        await dockerCompose(["exec", "-T", "screeps", "cli", "-c", "system.resumeSimulation();"]);
      } catch {
        /* ignore */
      }
    };
    stderr.write("Pausing simulation...\n");
    await dockerCompose(["exec", "-T", "screeps", "cli", "-c", "system.pauseSimulation();"]);
    didPause = true;
    const settleSec = parseInt(process.env.BACKUP_SETTLE_SECONDS ?? "5", 10);
    const ms = Number.isFinite(settleSec) ? settleSec * 1000 : 5000;
    stderr.write(`Waiting ${settleSec}s for simulation to settle...\n`);
    await sleep(ms);
  } else {
    stderr.write(
      "Screeps container is not running; skipping pause/resume and backing up Mongo/Redis only.\n",
    );
  }

  try {
    await fs.mkdir(path.join(ROOT, "backups"), { recursive: true });

    stderr.write("Backing up MongoDB...\n");
    await dockerCompose([
      "run",
      "-T",
      "--rm",
      "--no-deps",
      "-v",
      `${hostBindPath("backups")}:/backup`,
      "--entrypoint",
      "mongodump",
      "mongo",
      "--uri=mongodb://mongo:27017",
      "--db=screeps",
      "--gzip",
      "--quiet",
      `--archive=/backup/${prefix}.mongo.archive`,
    ]);

    stderr.write("Backing up Redis...\n");
    await dockerCompose([
      "run",
      "-T",
      "--rm",
      "--no-deps",
      "-v",
      `${hostBindPath("backups")}:/backup`,
      "--entrypoint",
      "/bin/sh",
      "redis",
      "-c",
      `exec redis-cli -h redis --rdb /backup/${prefix}.redis.rdb`,
    ]);

    stderr.write(
      `Backup finished: backups/${prefix}.mongo.archive and backups/${prefix}.redis.rdb\n`,
    );
  } finally {
    if (didPause && cleanupResume) await cleanupResume();
  }
}

/**
 * @param {string[]} args Remaining argv after `restore`
 * @returns {Promise<void>}
 */
async function cmdRestore(args) {
  if (args.length !== 1 || args[0].startsWith("-")) usage(1);
  const prefix = normalizePrefix(args[0]);
  const mongoArchive = path.join(ROOT, "backups", `${prefix}.mongo.archive`);
  const redisRdb = path.join(ROOT, "backups", `${prefix}.redis.rdb`);
  try {
    await fs.access(mongoArchive);
  } catch {
    stderr.write(`missing: ${mongoArchive}\n`);
    process.exit(1);
  }
  try {
    await fs.access(redisRdb);
  } catch {
    stderr.write(`missing: ${redisRdb}\n`);
    process.exit(1);
  }

  stderr.write(`Restoring backup prefix: ${prefix}\n`);

  await dockerCompose(["stop", "screeps"]);
  await restoreMongodbFromPrefix(prefix);

  const wantAof = await redisUsesAppendonly();
  if (wantAof && verbose >= 1) {
    stderr.write(
      "Redis server uses appendonly yes; will materialize AOF after RDB load.\n",
    );
  }

  await dockerCompose(["stop", "redis"]);
  await restoreRedisVolumeFromPrefix(prefix);

  if (wantAof) {
    stderr.write("Rebuilding Redis AOF from restored RDB...\n");
    await redisRebuildAof();
  } else {
    stderr.write("Starting Redis...\n");
  }
  await dockerCompose(["up", "-d", "--no-deps", "redis"]);
  await dockerCompose(["start", "screeps"]);
  stderr.write(`Restore complete (prefix ${prefix}).\n`);
}

/**
 * Expand `--verbose=N` into repeated `--verbose` so util.parseArgs works.
 * @param {string[]} argv
 * @returns {string[]}
 */
function expandVerboseEquals(argv) {
  const out = [];
  for (const a of argv) {
    if (a.startsWith("--verbose=")) {
      const n = parseInt(a.slice("--verbose=".length), 10);
      if (!Number.isFinite(n)) usage(1);
      const capped = Math.min(Math.max(n, 0), 2);
      for (let i = 0; i < capped; i++) out.push("--verbose");
    } else {
      out.push(a);
    }
  }
  return out;
}

/** @returns {Promise<void>} */
async function main() {
  const args = expandVerboseEquals(process.argv.slice(2));
  let parsed;
  try {
    parsed = parseArgs({
      args,
      strict: true,
      tokens: true,
      allowPositionals: true,
      options: {
        help: { type: "boolean", short: "h" },
        verbose: { type: "boolean", short: "v", multiple: true },
      },
    });
  } catch {
    usage(1);
  }
  const { values, positionals, tokens } = parsed;
  if (values.help) usage(0);

  verbose = 0;
  for (const t of tokens) {
    if (t.kind !== "option" || t.name !== "verbose") continue;
    const raw = t.rawName ?? "";
    if (raw === "--verbose") {
      verbose = Math.min(verbose + 1, 2);
    } else if (/^-v+$/.test(raw)) {
      const n = Math.min(raw.length - 1, 2);
      verbose = Math.min(Math.max(verbose + 1, n), 2);
    }
  }

  const cmd = positionals[0];
  if (!cmd) usage(1);
  if (cmd === "backup") await cmdBackup(positionals.slice(1));
  else if (cmd === "restore") await cmdRestore(positionals.slice(1));
  else usage(1);
}

main().catch((/** @type {unknown} */ e) => {
  const msg = e instanceof Error ? e.message : String(e);
  stderr.write(`${msg}\n`);
  process.exit(1);
});
