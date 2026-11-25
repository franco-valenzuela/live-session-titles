---
description: Propose better names for Claude desktop sidebar sections and groups, from the sessions they hold
argument-hint: "[--lang xx]"
---

Rename sidebar sections and groups in the Claude desktop app. Only manual sections (kind `manual`) and groups can be renamed; pinned, routines and the default sessions list cannot.

Arguments: $ARGUMENTS

1. List them: `mcp__ccd_sidebar__list_sections` and `mcp__ccd_sidebar__list_groups` (load them with ToolSearch if deferred).
2. Ask the user which to review (AskUserQuestion): "All", or one specific section or group.
3. For each one, read the titles of the sessions it holds (`mcp__ccd_session_mgmt__list_sessions`, include archived) and their folders. Propose a short name (1 to 4 words) that covers what those sessions share, using the dominant project or folder when it helps. If the current name already fits, mark it "no change".
4. Show a table: current name, proposed name. Then ask: apply all, edit one by one (accept, type another, or skip each), or cancel.
5. Save the log before applying: JSON `[{"source":"claude-section"|"claude-group","id","before","after"}]` to a temp file, then `live-session-titles history save <file>`.
6. Apply with `mcp__ccd_sidebar__rename_section` or `mcp__ccd_sidebar__rename_group`. Report what changed in one short summary.
