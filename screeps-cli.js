#! /usr/bin/env node
const screeps = require("@screeps/launcher");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

screeps.cli("localhost", 21026, rl);
