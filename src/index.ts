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

// Custom help handler for main program
program
  .name("db-cli")
  .description("A cross-platform database CLI tool for MySQL and Dameng (DM8)")
  .option('-c, --connection <dsn>', 'Database connection URL (e.g., mysql://user:pass@host:port/db or dameng://user:pass@host:port/db)')
  .action(() => {
    // Default action when no command is given
    console.log('Usage: db-cli [options] <command>');
    console.log('');
    console.log('A cross-platform database CLI tool for MySQL and Dameng (DM8)');
    console.log('');
    console.log('Options:');
    console.log('  -c, --connection    Database connection URL');
    console.log('');
    console.log('Commands:');
    console.log('  exec      Execute SQL statements');
    console.log('  desc      Describe database schema');
    console.log('  import    Import data from SQL or JSON file');
    console.log('  export    Export database data');
    console.log('');
  })
  .addCommand(execCmd)
  .addCommand(descCmd)
  .addCommand(importCmd)
  .addCommand(exportCmd);

// Handle --help flag manually
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  const cmdIndex = process.argv.findIndex((arg) => ['exec', 'desc', 'import', 'export'].includes(arg));
  if (cmdIndex === -1) {
    // Show main help
    console.log('Usage: db-cli [options] <command>');
    console.log('');
    console.log('A cross-platform database CLI tool for MySQL and Dameng (DM8)');
    console.log('');
    console.log('Options:');
    console.log('  -c, --connection    Database connection URL');
    console.log('');
    console.log('Commands:');
    console.log('  exec      Execute SQL statements');
    console.log('  desc      Describe database schema');
    console.log('  import    Import data from SQL or JSON file');
    console.log('  export    Export database data');
    console.log('');
    process.exit(0);
  } else {
    // Show subcommand help
    const cmd = process.argv[cmdIndex];
    if (cmd === 'exec') {
      console.log('Usage: db-cli exec [options]');
      console.log('');
      console.log('Execute SQL statements');
      console.log('');
      console.log('Options:');
      console.log('  --format          Output format: table, json, sql (default: "table")');
      console.log('  --autocommit      Auto-commit each statement (default: true)');
      console.log('  -h, --help        display help for command');
      console.log('');
      process.exit(0);
    } else if (cmd === 'desc') {
      console.log('Usage: db-cli desc [options]');
      console.log('');
      console.log('Describe database schema');
      console.log('');
      console.log('Options:');
      console.log('  -t, --table         Table name to describe');
      console.log('  -i, --indexes       Show indexes for the table');
      console.log('  -k, --foreign-keys  Show foreign keys for the table');
      console.log('  -D, --databases     List all databases');
      console.log('  -B, --tables        List all tables in current database');
      console.log('  -h, --help          display help for command');
      console.log('');
      process.exit(0);
    } else if (cmd === 'import') {
      console.log('Usage: db-cli import [options]');
      console.log('');
      console.log('Import data from SQL or JSON file');
      console.log('');
      console.log('Options:');
      console.log('  -f, --file        Input file path (.sql or .json)');
      console.log('  --autocommit      Auto-commit each statement (default: true)');
      console.log('  -h, --help        display help for command');
      console.log('');
      process.exit(0);
    } else if (cmd === 'export') {
      console.log('Usage: db-cli export [options]');
      console.log('');
      console.log('Export database data');
      console.log('');
      console.log('Options:');
      console.log('  -q, --query       SQL query to execute and export');
      console.log('  -t, --table       Table name to export (structure + data)');
      console.log('  -o, --output      Output file path (format auto-detected from extension: .sql or .json)');
      console.log('  -h, --help        display help for command');
      console.log('');
      process.exit(0);
    }
  }
}

program.parse();
