#!/usr/bin/env node

import { Command } from "commander";
import { execCmd } from "./cmd/exec";
import { descCmd } from "./cmd/desc";
import { importCmd } from "./cmd/import";
import { exportCmd } from "./cmd/export";
import { readFileSync } from "fs";
import path from "path";

// Read version from package.json
// __dirname is 'dist/index.js' directory, so we need to go up one level
const packageJsonPath = path.join(__dirname, "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

const program = new Command();

program
  .name("db-cli")
  .version(packageJson.version)
  .description("A cross-platform database CLI tool for MySQL and Dameng (DM8)")
  .option(
    "-c, --connection <dsn>",
    "Database connection URL (e.g., mysql://user:pass@host:port/db or dameng://user:pass@host:port/db)"
  )
  .addCommand(execCmd)
  .addCommand(descCmd)
  .addCommand(importCmd)
  .addCommand(exportCmd);

program.parse();
