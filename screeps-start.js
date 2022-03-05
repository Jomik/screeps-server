#! /usr/bin/env node
const fs = require("fs");
const path = require("path");
const screeps = require("@screeps/launcher");
const _ = require("lodash");
const yaml = require("js-yaml");
const { execSync: exec } = require("child_process");

const config = yaml.load(fs.readFileSync("/screeps/config.yml", "utf8"));

const loadPackage = (dir) =>
  JSON.parse(fs.readFileSync(path.resolve(dir, "package.json"), "utf8"));

const ModsDir = "/server/mods";

const getPackageName = (pkg) => {
  const i = pkg.lastIndexOf("@");
  // Scopes start with @
  if (i > 0) {
    return pkg.substring(0, i);
  }
  return pkg;
};

const applyModsAndBots = async () => {
  const mods = config.mods || [];
  const bots = config.bots || {};
  const packageJSON = loadPackage(ModsDir);
  const installedPackageNames = Object.keys(packageJSON.dependencies || {});
  const currentPackages = [...mods, ...Object.values(bots)];

  const currentPackageNames = currentPackages.map(getPackageName);

  const newPackages = _.difference(
    currentPackageNames,
    installedPackageNames
  ).map((name) => currentPackages.find((pkg) => pkg.startsWith(name)));
  const gonePackages = _.difference(installedPackageNames, currentPackageNames);

  if (gonePackages.length + newPackages.length === 0) {
    return;
  }

  console.log("Applying changes to mods");
  if (gonePackages.length > 0) {
    console.log("Removing", ...gonePackages);
    exec(`npm uninstall --silent --no-progress ${gonePackages.join(" ")}`, {
      cwd: ModsDir,
      stdio: "inherit",
    });
  }

  if (newPackages.length > 0) {
    console.log("Installing", ...newPackages);
    exec(`npm install --silent --no-progress -E ${newPackages.join(" ")}`, {
      cwd: ModsDir,
      stdio: "inherit",
    });
  }

  const modsJSON = { mods: [], bots: {} };
  for (const pkg of mods) {
    const pkgDir = path.resolve(ModsDir, "node_modules", getPackageName(pkg));
    const { main } = loadPackage(pkgDir);
    if (!main) {
      console.warn(
        `Missing 'main' key for ${pkg}, report this to the author of the package.`
      );
    }
    modsJSON.mods.push(path.relative("/server", path.resolve(pkgDir, main)));
  }

  for (const [name, pkg] of Object.entries(bots)) {
    const pkgDir = path.resolve(ModsDir, "node_modules", getPackageName(pkg));
    const { main } = loadPackage(pkgDir);
    if (!main) {
      console.warn(
        `Missing 'main' key for ${pkg}, report this to the author of the package.`
      );
    }
    modsJSON.bots[name] = path.relative(
      "/server",
      path.dirname(path.resolve(pkgDir, main))
    );
  }

  fs.writeFileSync("/server/mods.json", JSON.stringify(modsJSON));
};

const start = async () => {
  await applyModsAndBots();

  await screeps.start(
    {
      steam_api_key: process.env.STEAM_KEY || config.steamKey,
      storage_disable: false,
    },
    process.stdout
  );
};

start().catch((err) => {
  console.error(err);
  process.exit();
});
