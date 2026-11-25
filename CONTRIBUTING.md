# Contributing

Thanks for helping out. The project is small on purpose: one Node script with no dependencies, a skill file, four commands and a hook.

## Layout

- `bin/cli.js`: installer, uninstaller and the helpers the skill calls (Codex and OpenCode listing and renaming, history).
- `skills/live-session-titles/SKILL.md`: what the agent does while you work.
- `commands/`: the slash commands.
- `hooks/`: the Claude Code SessionStart hook.
- `rules/global-rule.md`: the short block added to each agent's global instructions.

## Running it locally

```bash
git clone https://github.com/franco-valenzuela/live-session-titles
cd live-session-titles
npm test
node bin/cli.js install --agents claude
node bin/cli.js status
node bin/cli.js uninstall
```

`npm test` checks syntax and prints the help. Please run `install` and `uninstall` once on your machine before opening a pull request, and check that your instructions file comes back the way it was.

## Ground rules

- No runtime dependencies. Node 18 built-ins only.
- It has to work on Windows, macOS and Linux. Use `path.join`, and do not shell out to tools that only exist on one OS.
- Never remove or rewrite a user's data. Back files up before changing them, and for Codex only append to `session_index.jsonl`.
- Keep the global rule short. It is loaded into every session.

## Adding an agent

Open a [new agent request](https://github.com/franco-valenzuela/live-session-titles/issues/new?template=new_agent.md) first, or go straight to a pull request that adds an entry to `AGENTS` in `bin/cli.js`. Say where the agent keeps its sessions and global rules, and whether it has any way to rename a chat. If it has none, it gets the rule-only treatment with the `Session: <title>` line.
