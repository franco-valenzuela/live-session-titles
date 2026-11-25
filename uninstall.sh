#!/usr/bin/env bash
# live-session-titles uninstaller for macOS and Linux.
# Usage:  curl -fsSL https://raw.githubusercontent.com/franco-valenzuela/live-session-titles/main/uninstall.sh | bash
# Add "-s -- --purge" to also delete the rename history.
set -euo pipefail

cli="$HOME/.live-session-titles/app/bin/cli.js"
if [ -f "$cli" ]; then
  node "$cli" uninstall "$@"
else
  npx -y github:franco-valenzuela/live-session-titles uninstall "$@"
fi
