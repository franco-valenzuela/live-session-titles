---
description: Restore the titles changed by the last bulk retitle run
argument-hint: "[--list] [run id]"
---

Undo a bulk run made by `/retitle-all` or `/retitle-sidebar`.

Arguments: $ARGUMENTS

1. With `--list`, run `live-session-titles history list` and show it. Stop.
2. Otherwise run `live-session-titles history last --json` (or `live-session-titles history show <run id> --json` when an id was given). Each item has `source`, `id`, `before`, `after`.
3. Show a preview table: current title, title to restore (`before`). Ask for approval. Apply nothing before a clear yes.
4. Restore each item with the same tool used to change it:
   - `claude`: `mcp__ccd_session_mgmt__set_session_title`
   - `claude-section`: `mcp__ccd_sidebar__rename_section`
   - `claude-group`: `mcp__ccd_sidebar__rename_group`
   - `codex`: `live-session-titles codex-rename <id> "<before>"`
   - `opencode`: `live-session-titles opencode-rename <id> "<before>"`
5. Skip items that fail and keep going. Then run `live-session-titles history mark-undone <run id>`.
6. Report how many were restored and which were skipped.
