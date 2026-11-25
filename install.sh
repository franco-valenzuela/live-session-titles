#!/usr/bin/env bash
# live-session-titles installer for macOS and Linux.
# Usage:  curl -fsSL https://raw.githubusercontent.com/franco-valenzuela/live-session-titles/main/install.sh | bash
# Flags:  curl -fsSL .../install.sh | bash -s -- --yes --agents claude,codex
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "live-session-titles needs Node.js 18 or newer. Install it from https://nodejs.org and run this again." >&2
  exit 1
fi

major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$major" -lt 18 ]; then
  echo "Node.js $major found. live-session-titles needs 18 or newer." >&2
  exit 1
fi

echo "Installing live-session-titles..."
# Reattach the terminal so the agent checklist can ask questions even when piped from curl.
if [ -t 1 ] && [ -e /dev/tty ]; then
  npx -y github:franco-valenzuela/live-session-titles install "$@" < /dev/tty
else
  npx -y github:franco-valenzuela/live-session-titles install --yes "$@"
fi
