---
description: Set the current session title, or generate one from the conversation
argument-hint: "[title text] [--max-words N] [--status]"
---

Rename the current session. Follow the `live-session-titles` skill for title rules and for the rename tool of the agent you run in.

Arguments: $ARGUMENTS

1. If the arguments contain title text (anything that is not a flag), use that text as the title, unchanged except for trimming spaces.
2. If there is no title text, read this conversation and write the best title for it:
   - the language of the conversation;
   - about 6 words (or the `--max-words N` value); a little longer only if needed, never hard to read;
   - with `--status`, use the form `Task: status`.
3. Apply it with the rename tool of the current agent (Claude desktop: `mcp__ccd_session_mgmt__set_session_title` with `session_id: "self"`; Codex: `live-session-titles codex-rename --current "<title>"`; OpenCode: `opencode.session.rename`).
4. If the agent has no rename tool, print `Session: <title>` and say in one line that this agent does not support renaming the real chat.
5. Reply with one line: the new title.
