---
name: live-session-titles
description: Keep the current chat/session title updated in place as work progresses, so the sidebar always shows what each session is doing. Use at the start of every task, whenever the work moves to a new stage, and when it finishes. Also use when the user says "rename this session", "change the title", "retitle", "/title", "/retitle-all", "/retitle-sidebar" or "/retitle-undo".
---

# Live session titles

Rename the session you are working in while you work. Never create a new session for this.

## Title rules

- Write the title in the language of the conversation (the language the user writes in).
- Default length: about 6 words. Go a little longer only when 6 words cannot name the task. Never more than about 10 words; it must read at a glance in a narrow sidebar.
- Name the task, not the chat: `Fix checkout rounding bug`, not `Help with code`.
- No quotes, no trailing period, no emoji, no filler words ("about", "regarding", "the").
- Status suffix is off by default. Turn it on only when the user asks for it (or passes `--status`): `Task: status`, for example `Audit payments: bug found`, `Audit payments: report ready`.
- The user can change the word limit with `--max-words N`, or by saying so. Remember their choice for the rest of the session.

## When to rename

1. Start of a task: set a title that names it.
2. The work changes stage or scope (investigation to fix, fix to release): update it.
3. The task finishes: update it if the title no longer matches, and (Claude desktop only) mark the session completed.
- Rename only when the current title is stale. Do not rename on every message.
- Do it in the same message as another tool call; never spend a turn only on renaming.
- If the user set the title by hand and declines your change, leave it alone for the rest of the session.
- A subagent cannot rename the session it runs in. Never rename another session unless the user asked.

## How to rename, per agent

### Claude Code desktop app (Code tab)
- Rename: `mcp__ccd_session_mgmt__set_session_title` with `session_id: "self"` and `title`. If the tool is deferred, load it first with ToolSearch `select:mcp__ccd_session_mgmt__set_session_title`.
- Finish: `mcp__ccd_sidebar__mark_completed` for the current session, when the task is done and nothing is pending on the user.

### Claude Code CLI (terminal)
- No live rename tool exists. Show the title as the first line of your reply once per stage: `Session: <title>`. Do not edit session files by hand.

### OpenCode
- Rename: `opencode.session.rename` (Code Mode) on the current session. In a child session (subagent) rename the child, never the parent.
- If that tool is missing, run: `live-session-titles opencode-rename <sessionID> "<title>"`.

### Codex (CLI and desktop)
- Rename: run `live-session-titles codex-rename --current "<title>"`. It appends one line to `~/.codex/session_index.jsonl`, the same file Codex writes when you rename from its UI. It never edits or deletes existing lines.

If `live-session-titles` is not on the PATH, run the same command as `node ~/.live-session-titles/app/bin/cli.js <command> ...` (on Windows: `node %USERPROFILE%\.live-session-titles\app\bin\cli.js <command> ...`).

### Cursor, Windsurf, Gemini CLI, Antigravity and other agents
- These agents give no way to rename the real chat. Show the title as the first line of your reply once per stage: `Session: <title>`.

## Commands

The installer adds these slash commands where the agent supports them. Their full steps live in the command files; summary:

- `/title [text]` - with text: set that title now. Without text: read the conversation, write the best title and apply it.
- `/retitle-all [--force] [--skip-running] [--lang xx] [--status] [--max-words N]` - retitle many sessions (active and archived) across Claude desktop, Codex and OpenCode. Preview first, apply only after approval.
- `/retitle-sidebar` - propose better names for sidebar sections and groups (Claude desktop).
- `/retitle-undo` - restore the titles changed by the last bulk run.

Bulk runs save a log in `~/.live-session-titles/history/` so `/retitle-undo` can restore them.
