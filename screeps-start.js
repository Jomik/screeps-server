#! /usr/bin/env node
const screeps = require("@screeps/launcher");
const _ = require("lodash");
const path = require("path");
const yaml = require("js-yaml");
const fs = require("fs");
const { execSync: exec } = require("child_process");

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

const apply = async (config) => {
  const { mods = [], bots = {} } = config;
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

  console.log("Applying changes to packages");
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
    const pkgJSON = loadPackage(pkgDir);
    modsJSON.mods.push(
      path.relative("/server", path.resolve(pkgDir, pkgJSON.main))
    );
  }

  for (const [name, pkg] of Object.entries(bots)) {
    const pkgDir = path.resolve(ModsDir, "node_modules", getPackageName(pkg));
    const pkgJSON = loadPackage(pkgDir);
    modsJSON.bots[name] = path.relative(
      "/server",
      path.dirname(path.resolve(pkgDir, pkgJSON.main))
    );
  }

  fs.writeFileSync("/server/mods.json", JSON.stringify(modsJSON));
};

const start = async () => {
  const config = yaml.load(fs.readFileSync("/screeps/config.yml", "utf8"));

  await apply(config);

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
