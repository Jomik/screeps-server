#! /usr/bin/env node
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { execSync } = require("child_process");

const RootDir = process.env["SERVER_DIR"];
const ConfigFile = process.env["CONFIG"];
if (!RootDir || !ConfigFile) {
  throw new Error(
    "Missing environment variables, check $SERVER_DIR and $CONFIG"
  );
}

const config = yaml.load(fs.readFileSync(ConfigFile, "utf8"));

const loadPackage = (dir) =>
  JSON.parse(fs.readFileSync(path.resolve(dir, "package.json"), "utf8"));

const ModsDir = path.resolve(RootDir, "mods");

const installPackages = () => {
  console.log("Updating dependencies");
  const mods = config.mods || [];
  const bots = config.bots || {};

  const modsPackage = loadPackage(ModsDir);
  const alreadyInstalledPackages = modsPackage.mods || [];
  const dependencies = modsPackage.dependecies || {};

  // Calculate package diff
  const packages = [...mods, ...Object.values(bots)];

  const newPackages = packages.filter(
    (p) => !alreadyInstalledPackages.includes(p)
  );
  const removedPackages = alreadyInstalledPackages.filter(
    (p) => !packages.includes(p)
  );

  if (removedPackages.length === 0 && newPackages.length === 0) {
    console.log("No dependency changes");
  }

  if (removedPackages.length > 0) {
    const packageNames = removedPackages
      .map((pkg) => {
        const entry =
          Object.entries(dependencies).find(
            ([name, version]) => pkg.includes(name) || version.includes(pkg)
          ) || [];
        return [pkg, entry[0]];
      })
      .filter(([, pkg]) => pkg !== undefined);

    console.log("Uninstalling", ...packageNames.map(([name]) => name));
    execSync(
      `npm uninstall --logevel=error --no-progress ${packageNames
        .map(([, pkg]) => pkg)
        .join(" ")}`,
      {
        cwd: ModsDir,
        stdio: "inherit",
      }
    );
  }

  if (newPackages.length > 0) {
    console.log("Installing", ...newPackages);
    execSync(
      `npm install --logevel=error --no-progress -E ${newPackages.join(" ")}`,
      {
        cwd: ModsDir,
        stdio: "inherit",
      }
    );
  }

  const newPackage = loadPackage(ModsDir);
  newPackage["mods"] = packages;
  fs.writeFileSync(
    path.resolve(ModsDir, "package.json"),
    JSON.stringify(newPackage, null, 2)
  );

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
        `Missing 'main' key for ${pkg}, report this to the author of the package.`
      );
    }
    const mainPath = path.relative(RootDir, path.resolve(pkgDir, main));

    if (mods.some((m) => m.includes(name) || version.includes(m))) {
      modsJSON.mods.push(mainPath);
      continue;
    }

    const bot = Object.entries(bots).find(
      ([, dep]) => dep.includes(name) || version.includes(dep)
    );
    if (bot) {
      modsJSON.bots[bot[0]] = path.dirname(mainPath);
      continue;
    }
  }

  fs.writeFileSync(
    path.resolve(RootDir, "mods.json"),
    JSON.stringify(modsJSON, null, 2)
  );
  console.log("Mods have been configured");
};

const start = async () => {
  installPackages();
  writeModsConfiguration();

  const screeps = require("@screeps/launcher");
  await screeps.start(
    {
      steam_api_key: process.env.STEAM_KEY || config.steamKey,
      storage_disable: false,
    },
    process.stdout
  );
};

start().catch((err) => {
  console.error(err.message);
  process.exit();
});
