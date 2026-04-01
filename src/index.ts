#!/usr/bin/env node

import { Command } from 'commander';
import { execCmd } from './cmd/exec';
import { descCmd } from './cmd/desc';
import { importCmd } from './cmd/import';
import { exportCmd } from './cmd/export';

const program = new Command();

program
  .name('db-cli')
  .version('2.0.0')
  .description('A cross-platform database CLI tool for MySQL and Dameng (DM8)')
  .addCommand(execCmd)
  .addCommand(descCmd)
  .addCommand(importCmd)
  .addCommand(exportCmd);

program.parse();
