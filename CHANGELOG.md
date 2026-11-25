# Changelog

## 1.0.0 (2026-11-25)

First release.

- Live session titles in the language of the conversation, about 6 words, with `--max-words` and an optional `--status` suffix.
- Marks the session as completed in the Claude desktop app when the task ends.
- `/title`, `/retitle-all`, `/retitle-sidebar` and `/retitle-undo` commands.
- Bulk retitle for Claude, Codex and OpenCode sessions, archived ones included, with a preview before anything changes.
- Unlimited rename history for undo.
- Installer for Windows, macOS and Linux with an agent checklist, plus `--yes` and `--agents`.
- Rule-only support for Gemini CLI, Antigravity, Windsurf and Cursor.
- SessionStart hook for Claude Code with a weekly update check (`LST_NO_UPDATE_CHECK=1` turns it off).
- Published on npm as `live-session-titles` and `@franco-valenzuela/live-session-titles`.
