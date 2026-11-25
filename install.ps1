# live-session-titles installer for Windows (PowerShell 5.1+).
# Usage:  irm https://raw.githubusercontent.com/franco-valenzuela/live-session-titles/main/install.ps1 | iex
# Flags through an env var, because "irm | iex" cannot pass arguments:
#   $env:LST_ARGS = "--yes --agents claude,codex"; irm .../install.ps1 | iex

$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'live-session-titles needs Node.js 18 or newer. Install it from https://nodejs.org and run this again.' -ForegroundColor Yellow
    return
}

$major = [int]((node -p "process.versions.node.split('.')[0]").Trim())
if ($major -lt 18) {
    Write-Host "Node.js $major found. live-session-titles needs 18 or newer." -ForegroundColor Yellow
    return
}

$extra = @()
if ($env:LST_ARGS) { $extra = $env:LST_ARGS -split '\s+' | Where-Object { $_ } }

Write-Host 'Installing live-session-titles...'
& npx.cmd -y github:franco-valenzuela/live-session-titles install @extra
