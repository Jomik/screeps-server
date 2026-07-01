#! /usr/bin/env node
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { execSync } = require("child_process");

const RootDir = process.env["SERVER_DIR"];
if (!RootDir) {
  throw new Error("Missing environment variable $SERVER_DIR");
}
const ConfigPath = path.join(RootDir, "config.yml");
const ManagedDepsPath = path.join(RootDir, "mods", "managed-deps.json");

process.chdir(RootDir);
fs.mkdirSync(path.dirname(ManagedDepsPath), { recursive: true });

const rawConfig = /** @type {Config} */ (yaml.load(fs.readFileSync(ConfigPath, "utf8"))) || {};

const steamKey = process.env.STEAM_KEY || rawConfig.steamKey;
if (!steamKey) {
  throw new Error("Missing steam API key. Set the STEAM_KEY environment variable or steamKey in config.yml.");
}

/** @type {ResolvedConfig} */
const config = {
  steamKey,
  mods: rawConfig.mods || [],
  bots: rawConfig.bots || {},
  launcherOptions: {
    autoUpdate: false,
    ...rawConfig.launcherOptions,
  },
};

/**
 * @param {string} dir
 * @returns {any}
 */
const loadPackage = (dir) =>
  JSON.parse(fs.readFileSync(path.resolve(dir, "package.json"), "utf8"));

const VERSION = /^(=|^|~|<|>|<=|>=)?\d+(?:\.\d+(?:\.\d+(?:.*)?)?)?$/

/**
 * 
 * @param {string} spec 
 * @returns 
 */
const parseVersionSpec = (spec) => {
  const atIdx = spec.lastIndexOf("@");
  if (atIdx === -1) {
    return [spec, "latest"];
  }
  const name = spec.substring(0, atIdx);
  const version = spec.substring(atIdx + 1);
  if (!version.match(VERSION)) {
    return [spec, "latest"];
  }
  return [name, version];
}

/**
 * @param {string} spec
 * @returns {boolean}
 */
const isPathLikeSpec = (spec) =>
  spec.startsWith("/") ||
  spec.startsWith("./") ||
  spec.startsWith("../") ||
  spec.startsWith("file:");

/**
 * @param {string} spec
 * @returns {string | undefined}
 */
const getNameFromPathLikeSpec = (spec) => {
  const rawPath = spec.startsWith("file:") ? spec.slice("file:".length) : spec;
  const pkgPath = path.resolve(rawPath, "package.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return typeof parsed.name === "string" ? parsed.name : undefined;
  } catch {
    return undefined;
  }
};

/**
 * @returns {{ mods: Array<{spec: string; name: string; version: string | null}>; bots: Record<string, {spec: string; name: string; version: string | null}> }}
 */
const loadManagedDeps = () => {
  try {
    const parsed = JSON.parse(fs.readFileSync(ManagedDepsPath, "utf8"));
    return {
      mods: Array.isArray(parsed.mods) ? parsed.mods : [],
      bots: parsed.bots && typeof parsed.bots === "object" ? parsed.bots : {},
    };
  } catch {
    return { mods: [], bots: {} };
  }
};

/**
 * @param {{ mods: Array<{spec: string; name: string; version: string | null}>; bots: Record<string, {spec: string; name: string; version: string | null}> }} managed
 */
const writeManagedDeps = (managed) => {
  fs.writeFileSync(ManagedDepsPath, JSON.stringify(managed, null, 2));
};

/**
 * @param {string[]} specs
 * @param {Record<string, string>} dependencies
 * @returns {string[]}
 */
const resolvePackageNames = (specs, dependencies) => specs
  .map((spec) => {
    const [parsedName] = parseVersionSpec(spec);
    if (dependencies[parsedName] !== undefined) {
      return parsedName;
    }

    if (isPathLikeSpec(spec)) {
      const localName = getNameFromPathLikeSpec(spec);
      if (localName && dependencies[localName] !== undefined) {
        return localName;
      }
    }

    const matchingByExactVersion = Object.entries(dependencies).find(
      ([, version]) => version === spec,
    );
    if (matchingByExactVersion) {
      return matchingByExactVersion[0];
    }

    return undefined;
  })
  .filter((name) => name !== undefined);

/**
 * @param {string} packageName
 * @returns {string | null}
 */
const getInstalledVersion = (packageName) => {
  const pkgDir = path.resolve(RootDir, "node_modules", packageName);
  try {
    const pkg = loadPackage(pkgDir);
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
};

/**
 * @param {string[]} mods
 * @param {Record<string, string>} bots
 * @param {Record<string, string>} dependencies
 */
const buildResolvedManagedDeps = (mods, bots, dependencies) => {
  const resolvedMods = mods
    .map((spec) => {
      const [name] = resolvePackageNames([spec], dependencies);
      if (!name) return undefined;
      return { spec, name, version: getInstalledVersion(name) };
    })
    .filter((entry) => entry !== undefined);

  /** @type {Record<string, {spec: string; name: string; version: string | null}>} */
  const resolvedBots = {};
  for (const [botName, spec] of Object.entries(bots)) {
    const [name] = resolvePackageNames([spec], dependencies);
    if (!name) continue;
    resolvedBots[botName] = { spec, name, version: getInstalledVersion(name) };
  }

  return { mods: resolvedMods, bots: resolvedBots };
};

/**
 * @param {string} spec
 * @param {string | null} version
 * @param {string | undefined} name
 * @returns {string}
 */
const getInstallSpec = (spec, version, name) => {
  if (version && name && !isPathLikeSpec(spec)) {
    return `${name}@${version}`;
  }
  return spec;
};

const installPackages = () => {
  console.log("Updating dependencies");
  const mods = config.mods;
  const bots = config.bots;
  const managed = loadManagedDeps();

  const rootPackage = loadPackage(RootDir);
  const dependencies = rootPackage.dependencies || {};
  const managedResolvedMods = managed.mods || [];
  const managedResolvedBots = managed.bots || {};

  const removedPackages = [
    ...managedResolvedMods
      .filter((entry) => !mods.includes(entry.spec))
      .map((entry) => entry.name),
    ...Object.entries(managedResolvedBots)
      .filter(([botName, entry]) => bots[botName] !== entry.spec)
      .map(([, entry]) => entry.name),
  ];

  const modInstallSpecs = mods.map((spec) => {
    const locked = managedResolvedMods.find((entry) => entry.spec === spec);
    return getInstallSpec(spec, locked?.version || null, locked?.name);
  });
  const botInstallSpecs = Object.entries(bots).map(([botName, spec]) => {
    const locked = managedResolvedBots[botName];
    if (locked && locked.spec === spec) {
      return getInstallSpec(spec, locked.version, locked.name);
    }
    return spec;
  });
  const desiredInstallSpecs = [...modInstallSpecs, ...botInstallSpecs];

  const newPackages = desiredInstallSpecs.filter((installSpec) => {
    const [name, version] = parseVersionSpec(installSpec);
    if (isPathLikeSpec(installSpec)) {
      const localName = getNameFromPathLikeSpec(installSpec);
      return !localName || dependencies[localName] === undefined;
    }
    const installedVersion = dependencies[name];
    if (installedVersion === undefined) {
      return true;
    }
    if (version === "latest") {
      return false;
    }
    return installedVersion !== version;
  });

  if (removedPackages.length === 0 && newPackages.length === 0) {
    console.log("No dependency changes");
  }

  if (removedPackages.length > 0) {
    const packageNames = [...new Set(removedPackages)];

    if (packageNames.length > 0) {
      console.log("Uninstalling", ...packageNames);
      execSync(
        `npm uninstall --no-progress ${packageNames.join(" ")}`,
        {
          cwd: RootDir,
          stdio: "inherit",
          encoding: "utf8",
        },
      );
    }
  }

  if (newPackages.length > 0) {
    console.log("Installing", ...newPackages);
    execSync(
      `npm install --no-progress -E ${newPackages.join(" ")}`,
      {
        cwd: RootDir,
        stdio: "inherit",
        encoding: "utf8",
      },
    );
  }

  const updatedDependencies = loadPackage(RootDir).dependencies || {};
  writeManagedDeps(buildResolvedManagedDeps(mods, bots, updatedDependencies));
  console.log("Done updating");
}

/**
 * 
 * @param {boolean} doUpdate 
 * @returns 
 */
const updatePackages = (doUpdate) => {
  const mods = config.mods;
  const bots = config.bots;

  const rootPackage = loadPackage(RootDir);
  const dependencies = rootPackage.dependencies || {};

  const configuredPackages = [...mods, ...Object.values(bots)];
  const packagedMods = configuredPackages
    .map((pkg) => {
      const [name, version] = parseVersionSpec(pkg);
      const installedName = resolvePackageNames([pkg], dependencies)[0];
      return installedName ? [installedName, version] : undefined;
    })
    .filter((entry) => entry !== undefined);
  const packageNames = [...new Set(packagedMods.map(([name]) => name))];

  if (packageNames.length === 0) {
    console.log("No installed mods/bots found for update checks");
    return false;
  }

  let outdated = {};
  try {
    // `npm outdated --json` returns 1 if there are outdated packages,
    // which causes `execSync` to throw an error.
    const output = execSync(`npm outdated --json ${packageNames.join(" ")} || true`, {
      cwd: RootDir,
      encoding: "utf8",
      stdio: "pipe",
    });
    outdated = output.trim() ? JSON.parse(output) : {};
  } catch {
  }

  const versionSpecs = [];
  for (const [mod, info] of Object.entries(outdated)) {
    const [name, version] = packagedMods.find(([pkg]) => mod === pkg) || [];
    if (!name) continue;
    if (version !== "latest") {
      console.log(`package ${name} is pinned to version ${version}, ignoring`);
      continue;
    }
    versionSpecs.push(`${mod}@${info.latest}`);
  }

  if (versionSpecs.length === 0) {
    console.log(`All mods are up to date!`);
    return false;
  }

  if (!doUpdate) {
    console.log(`There are outdated mods needing an update:`, ...versionSpecs);
    return true;
  }

  console.log(`Updating outdated mods`, ...versionSpecs);
  execSync(`npm install --loglevel=error --no-progress -E ${versionSpecs.join(" ")}`, {
    cwd: RootDir,
    stdio: "inherit",
    encoding: "utf8",
  });
  const updatedDependencies = loadPackage(RootDir).dependencies || {};
  writeManagedDeps(buildResolvedManagedDeps(mods, bots, updatedDependencies));
  return false;
};

const writeModsConfiguration = () => {
  console.log("Writing mods configuration");
  const mods = config.mods;
  const bots = config.bots;
  const { dependencies = {} } = loadPackage(RootDir);
  /** @type {Pick<ResolvedConfig, "mods" | "bots">} */
  const modsJSON = { mods: [], bots: {} };

  const configuredMods = resolvePackageNames(mods, dependencies);
  const unresolvedMods = mods.filter(
    (spec) => !resolvePackageNames([spec], dependencies)[0],
  );
  const configuredBots = Object.entries(bots).map(([botName, spec]) => {
    const [name] = resolvePackageNames([spec], dependencies);
    return [botName, name];
  });

  for (const modSpec of unresolvedMods) {
    console.warn(`Could not resolve configured mod "${modSpec}" package.`);
  }

  for (const name of configuredMods) {
    const pkgDir = path.resolve(RootDir, "node_modules", name);
    const pkg = loadPackage(pkgDir);
    const main = pkg.main || "index.js";

    if (!pkg.screeps_mod) {
      console.warn(
        `Package "${name}" is missing "screeps_mod: true"; loading anyway because it is explicitly configured.`,
      );
    }
    const mainPath = path.resolve(pkgDir, main);
    modsJSON.mods.push(mainPath);
  }

  for (const [botName, name] of configuredBots) {
    if (!name) {
      console.warn(`Could not resolve configured bot "${botName}" package.`);
      continue;
    }

    const pkgDir = path.resolve(RootDir, "node_modules", name);
    const pkg = loadPackage(pkgDir);
    const main = pkg.main || "index.js";

    if (!pkg.screeps_bot) {
      console.warn(
        `Package "${name}" for bot "${botName}" is missing "screeps_bot: true"; loading anyway because it is explicitly configured.`,
      );
    }

    const mainPath = path.resolve(pkgDir, main);
    modsJSON.bots[botName] = path.dirname(mainPath);
  }

  fs.writeFileSync("mods.json", JSON.stringify(modsJSON, null, 2));
  console.log("Mods have been configured");
};

// Map from camelCase to snake_case
const LauncherConfigMap = {
  // NOTE: We assume this is outdated and we want one multi thread runner.
  // runnerCount: "runners_cnt",
  runnerThreads: "runner_threads",
  processorCount: "processors_cnt",
  storageTimeout: "storage_timeout",
  logConsole: "log_console",
  logRotateKeep: "log_rotate_keep",
  restartInterval: "restart_interval",
};

const getPhysicalCores = () => {
  const nproc = execSync("nproc --all", { encoding: "utf8" });

  const cores = Number.parseInt(nproc.trim(), 10);
  if (Number.isNaN(cores) && cores < 1) {
    console.warn("Error getting number of physical cores, defaulting to 1");
    return 1;
  }
  return cores;
};

const start = async () => {
  installPackages();
  writeModsConfiguration();

  const updateOpt = process.argv.includes("--update");
  const updateNeeded = updatePackages(updateOpt || (config.launcherOptions.autoUpdate ?? false));

  if (updateOpt) {
    process.exit(updateNeeded ? 1 : 0);
  }

  // @ts-ignore We can't load that from the outer non-Node 10 side
  const screeps = require("@screeps/launcher");
  const cores = getPhysicalCores();

  /** @type {Record<string, any>} */
  const options = {
    steam_api_key: config.steamKey,
    storage_disable: false,
    processors_cnt: cores,
    runners_cnt: 1,
    runner_threads: Math.max(cores - 1, 1),
  };

  const launcherOptions = config.launcherOptions;

  for (const [configKey, optionsKey] of Object.entries(LauncherConfigMap)) {
    if (configKey in launcherOptions) {
      // @ts-expect-error Accessing launcherOptions without an string index
      options[optionsKey] = launcherOptions[configKey];
    }
  }

  await screeps.start(options, process.stdout);
};

start().catch((err) => {
  console.error(err.message);
  process.exit();
});
