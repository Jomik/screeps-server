#! /usr/bin/env node
const screeps = require("@screeps/launcher");
const commander = require("commander");
const readline = require("readline");
const _ = require("lodash");
const path = require("path");
const yaml = require("js-yaml");
const fs = require("fs");
const { execSync: exec } = require("child_process");

const loadPackage = (dir) =>
  JSON.parse(fs.readFileSync(path.resolve(dir, "package.json"), "utf8"));

const ModsDir = "/server/mods";

const apply = async (config) => {
  const { mods = [], bots = {} } = config;
  const packageJSON = loadPackage(ModsDir);
  const packages = Object.keys(packageJSON.dependencies || {});
  const currentPackages = [...mods, ...Object.values(bots)];

  const newPackages = _.difference(currentPackages, packages);
  const gonePackages = _.difference(packages, currentPackages);

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
    const pkgDir = path.resolve(ModsDir, "node_modules", pkg);
    const pkgJSON = loadPackage(pkgDir);
    modsJSON.mods.push(
      path.relative(ModsDir, path.resolve(pkgDir, pkgJSON.main))
    );
  }

  for (const [name, pkg] of Object.entries(bots)) {
    const pkgDir = path.resolve(ModsDir, "node_modules", pkg);
    const pkgJSON = loadPackage(pkgDir);
    modsJSON.bots[name] = path.relative(
      ModsDir,
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

commander.usage(
  '[options] <command>\n\n  Use "screeps <command> --help" to learn about specific command usage.'
);

commander
  .command("start")
  .description("Start all processes.")
  .action(() => {
    start().catch((err) => {
      console.error(err);
      process.exit();
    });
  });

commander
  .command("cli")
  .description("Connect to the CLI interface of the main process.")
  .action(() => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "> ",
    });

    screeps.cli("localhost", 21026, rl);
  });

commander.command("*").action(() => {
  console.log(
    'Unknown command. Type "screeps --help" to get the list of all commands.'
  );
  process.exit();
});

if (process.argv.length === 2) {
  commander.help();
} else {
  commander.parse(process.argv);
}
