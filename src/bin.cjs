#!/usr/bin/env node
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const result = spawnSync(process.execPath, ['--openssl-legacy-provider', path.join(__dirname, 'db-cli.js'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false
});

process.exitCode = result.status;
