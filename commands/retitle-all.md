---
description: Retitle many sessions at once across Claude desktop, Codex and OpenCode, with preview and undo
argument-hint: "[--force] [--skip-running] [--lang xx] [--status] [--max-words N] [--agents claude,codex,opencode]"
---

Retitle past sessions in bulk. Follow the `live-session-titles` skill for title rules.

Arguments: $ARGUMENTS

Flags:
- `--force`: propose a new title for every session. Default: only sessions that need one (see step 2).
- `--skip-running`: leave sessions that are running right now untouched. Default: include them.
- `--lang xx`: write every title in this language (for example `en`, `es-AR`). Default: the language of each session's own conversation.
- `--status`: use the `Task: status` form.
- `--max-words N`: word limit, default 6.
- `--agents a,b`: limit to some sources. Default: every source available on this machine.

## 1. Collect sessions

- Claude desktop: `mcp__ccd_session_mgmt__list_sessions` with `include_archived: true`. If the result is too large, page with a smaller `limit`. Never unarchive a session.
- Codex: run `live-session-titles codex-list --json`. Each item has `id`, `title`, `cwd`, `updated_at`, `archived` and `preview` (first user messages).
- OpenCode: run `live-session-titles opencode-list --json`. If it says the OpenCode CLI is missing, skip OpenCode and say so once.

## 2. Decide which sessions need a title

Without `--force`, a session needs a title when its current title is empty, a default ("New session", "Untitled", a timestamp or id), a raw copy of the first prompt, longer than about 10 words, or clearly unrelated to the conversation. Keep good titles as they are.

## 3. Write titles with cheap subagents

Split the sessions that need a title into batches of about 20. For each batch launch a subagent on the cheapest model available (Claude: `model: "haiku"`). Give it, per session: id, current title, cwd and a short preview of the conversation (Claude desktop: `mcp__ccd_session_mgmt__get_session` or `search_session_transcripts`; Codex and OpenCode: the `preview` field). Ask it to return JSON `[{"id","title"}]` following the title rules. Run batches in parallel.

## 4. Preview and approval

Show one table: source, current title, proposed title. Mark running sessions. Then ask the user (AskUserQuestion when available): apply all, edit some, or cancel. Apply nothing before a clear yes.

## 5. Apply and log

1. Save the log first: write the planned changes as JSON `[{"source","id","before","after"}]` to a temp file and run `live-session-titles history save <file>`.
2. Apply:
   - Claude desktop: `mcp__ccd_session_mgmt__set_session_title` with the session id. The current session uses `"self"`.
   - Codex: `live-session-titles codex-rename <id> "<title>"`.
   - OpenCode: `live-session-titles opencode-rename <id> "<title>"`.
3. If one fails (for example the app refuses an archived session), skip it and keep going.

## 6. Report

One short summary: how many renamed per source, which were skipped and why, and that `/retitle-undo` restores them.
