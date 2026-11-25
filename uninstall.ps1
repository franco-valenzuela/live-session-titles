# live-session-titles uninstaller for Windows.
# Usage:  irm https://raw.githubusercontent.com/franco-valenzuela/live-session-titles/main/uninstall.ps1 | iex
# Removes only what the installer added: the rule block between its markers, the skill, the commands,
# the Claude hook and the launcher. Rename history stays unless $env:LST_ARGS = "--purge".

$ErrorActionPreference = 'Stop'
$cli = Join-Path $HOME '.live-session-titles\app\bin\cli.js'
$extra = @()
if ($env:LST_ARGS) { $extra = $env:LST_ARGS -split '\s+' | Where-Object { $_ } }

if (Test-Path $cli) {
    & node $cli uninstall @extra
} else {
    & npx.cmd -y github:franco-valenzuela/live-session-titles uninstall @extra
}
