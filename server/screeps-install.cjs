#! /usr/bin/env node
// @ts-ignore We can't load that from the outer non-Node 10 side
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { execSync } = require("child_process");

const RootDir = process.env["SERVER_DIR"];
if (!RootDir) {
  throw new Error("Missing environment variable $SERVER_DIR");
}

process.chdir(RootDir);

const SERVER_COMPONENTS = ["backend", "common", "driver", "engine", "isolated-vm", "launcher", "pathfinding", "screeps", "storage"];

const start = async () => {
  const customComponents = JSON.parse(process.env["SCREEPS_COMPONENTS"] || "{}");
  if (!customComponents) {
    console.log("Installation complete, no custom components requested.");
    return;
  }
  
  console.log("Installing custom components…");
  for (const part of SERVER_COMPONENTS) {
    if (!customComponents[part]) continue;
    let installPath = customComponents[part];

    if (part === "engine") {
      // Engine is a special snowflake; it needs to be `gulp`ed beforehand
      const [repo, branch] = installPath.split("#");
      const installDir = path.basename(repo);
      console.log(`Preparing custom ${part} from ${customComponents[part]} in ${installDir}`);
      execSync(`git clone ${repo}`, {
        cwd: RootDir,
        stdio: "inherit",
        encoding: 'utf8',
      });
      execSync(`git checkout ${branch}`, {
        cwd: installDir,
        stdio: "inherit",
        encoding: 'utf8',
      });
      execSync(`npm clean-install`, {
        cwd: installDir,
        stdio: "inherit",
        encoding: 'utf8',
      });
      execSync(`npm run prepublish`, {
        cwd: installDir,
        stdio: "inherit",
        encoding: 'utf8',
      });
      installPath = installDir;
    }

    console.log(`Installing custom ${part} from ${customComponents[part]}`);
    execSync(
      `npm install --logevel=error --no-progress ${installPath}`,
      {
        cwd: RootDir,
        stdio: "inherit",
        encoding: "utf8",
      },
    );
  }
  console.log("Installation complete.");
}

start().catch((err) => {
  console.error(err.message, err.stack);
  process.exit(-1);
});
