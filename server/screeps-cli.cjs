#! /usr/bin/env node
// @ts-ignore We can't load that from the outer non-Node 10 side
const screeps = require("@screeps/launcher");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

screeps.cli("localhost", 21026, rl);
