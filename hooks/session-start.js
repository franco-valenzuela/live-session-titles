#!/usr/bin/env node
// SessionStart hook: reminds the agent to keep the title current and, at most once a week,
// prints a notice when a newer version exists. Never fails the session.
'use strict';
const path = require('path');

async function main() {
  const lines = ['live-session-titles: give this session a short title in the language of the conversation as soon as the task is clear, and update it when the work changes stage.'];
  try {
    const cli = require(path.join(__dirname, '..', 'bin', 'cli.js'));
    const msg = await cli.checkUpdate({ _: [] });
    if (msg) lines.push(msg);
  } catch { /* silent: no network, missing file, anything */ }
  process.stdout.write(lines.join('\n') + '\n');
}

main().catch(() => process.exit(0));
