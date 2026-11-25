#!/usr/bin/env node
// Publishes the package twice: as "live-session-titles" and as "@francovalenzuela/live-session-titles".
// Run "npm login" first. package.json is restored even if a publish fails.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const file = path.join(__dirname, '..', 'package.json');
const original = fs.readFileSync(file, 'utf8');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const names = ['live-session-titles', '@francovalenzuela/live-session-titles'];
let failed = false;

try {
  for (const name of names) {
    const pkg = JSON.parse(original);
    pkg.name = name;
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
    // Skip versions already on the registry, so a rerun only retries the ones that failed.
    const seen = spawnSync(npm, ['view', `${name}@${pkg.version}`, 'version'], { encoding: 'utf8', shell: process.platform === 'win32' });
    if (seen.status === 0 && seen.stdout.trim() === pkg.version) {
      console.log(`\n${name}@${pkg.version} is already published, skipping.`);
      continue;
    }
    console.log(`\nPublishing ${name}@${pkg.version}...`);
    const r = spawnSync(npm, ['publish', '--access', 'public', ...process.argv.slice(2)], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0) { failed = true; console.error(`Publish of ${name} failed.`); }
  }
} finally {
  fs.writeFileSync(file, original);
}
process.exit(failed ? 1 : 0);
