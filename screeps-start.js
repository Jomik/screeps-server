#! /usr/bin/env node
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { execSync } = require("child_process");

const RootDir = process.env["SERVER_DIR"];
if (!RootDir) {
  throw new Error("Missing environment variable $SERVER_DIR");
}
const ModsDir = path.join(RootDir, "mods");
const ConfigPath = path.join(RootDir, "config.yml");

process.chdir(RootDir);

const config = yaml.load(fs.readFileSync(ConfigPath, "utf8"));

const loadPackage = (dir) =>
  JSON.parse(fs.readFileSync(path.resolve(dir, "package.json"), "utf8"));

const isDependency = (pkg, [name, version]) =>
  pkg.includes(name) || version.includes(pkg);

const installPackages = () => {
  console.log("Updating dependencies");
  const mods = config.mods || [];
  const bots = config.bots || {};

  const modsPackage = loadPackage(ModsDir);
  const dependencies = modsPackage.dependencies || {};

  // Calculate package diff
  const packages = [...mods, ...Object.values(bots)];

  const newPackages = packages.filter(
    (pkg) =>
      !Object.entries(dependencies).some((dependency) =>
        isDependency(pkg, dependency),
      ),
  );
  const removedPackages = Object.entries(dependencies).filter(
    (dependency) => !packages.some((pkg) => isDependency(pkg, dependency)),
  );

  if (removedPackages.length === 0 && newPackages.length === 0) {
    console.log("No dependency changes");
  }

  if (removedPackages.length > 0) {
    const packageNames = removedPackages
      .map((pkg) => {
        const entry =
          Object.entries(dependencies).find(
            ([name, version]) => pkg.includes(name) || version.includes(pkg),
          ) || [];
        return entry[0];
      })
      .filter((name) => name !== undefined);

    console.log("Uninstalling", ...packageNames);
    execSync(
      `npm uninstall --logevel=error --no-progress ${packageNames.join(" ")}`,
      {
        cwd: ModsDir,
        stdio: "inherit",
        encoding: "utf8",
      },
    );
  }

  if (newPackages.length > 0) {
    console.log("Installing", ...newPackages);
    execSync(
      `npm install --logevel=error --no-progress -E ${newPackages.join(" ")}`,
      {
        cwd: ModsDir,
        stdio: "inherit",
        encoding: "utf8",
      },
    );
  }

  console.log("Done updating");
};

const writeModsConfiguration = () => {
  console.log("Writing mods configuration");
  const mods = config.mods || [];
  const bots = config.bots || {};
  const { dependencies } = loadPackage(ModsDir);
  const modsJSON = { mods: [], bots: {} };

  for (const [name, version] of Object.entries(dependencies)) {
    const pkgDir = path.resolve(ModsDir, "node_modules", name);
    const { main } = loadPackage(pkgDir);
    if (!main) {
      console.warn(
        `Missing 'main' key for ${pkg}, report this to the author of the package.`,
      );
    }
    const mainPath = path.resolve(pkgDir, main);

    if (mods.some((m) => m.includes(name) || version.includes(m))) {
      modsJSON.mods.push(mainPath);
      continue;
    }

    const bot = Object.entries(bots).find(
      ([, dep]) => dep.includes(name) || version.includes(dep),
    );
    if (bot) {
      modsJSON.bots[bot[0]] = path.dirname(mainPath);
      continue;
    }
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

  const screeps = require("@screeps/launcher");
  const cores = getPhysicalCores();

  const options = {
    steam_api_key: process.env.STEAM_KEY || config.steamKey,
    storage_disable: false,
    processors_cnt: cores,
    runners_cnt: 1,
    runner_threads: Math.max(cores - 1, 1),
  };

  const launcherOptions = config.launcherOptions || {};

  for (const [configKey, optionsKey] of Object.entries(LauncherConfigMap)) {
    if (configKey in launcherOptions) {
      options[optionsKey] = launcherOptions[configKey];
    }
  }

  await screeps.start(options, process.stdout);
};

start().catch((err) => {
  console.error(err.message);
  process.exit();
});
