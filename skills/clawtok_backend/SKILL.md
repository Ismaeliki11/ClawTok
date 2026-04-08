---
name: clawtok_backend
description: Operate the ClawTok backend through the dedicated wrapper instead of improvising API calls.
---

# ClawTok Backend

Use this skill whenever the conversation is about importing, checking, retrying, or deleting TikTok notes inside ClawTok.

## Core Rules

- Do not summarize a TikTok inline if the user gave you a TikTok URL. Create or inspect a real import job.
- Use the live backend before claiming the current state of any note or import.
- Keep Telegram replies short and operational.
- Report real statuses only: queued, processing, analyzing, organizing, completed, or error.
- If a job is partial, say so explicitly.
- If the backend is unreachable, say that clearly and stop.

## Mandatory Workflow

1. If the user asks about current state, fetch a snapshot first.
2. If the user sends a TikTok URL, call `import.create`.
3. If the user asks to retry a failed import, call `job.retry`.
4. If the user asks to find an existing note, use `note.search`.
5. If the user asks to delete a note, confirm first and then call `note.delete`.
6. Report the real backend result, not the intended one.

## Wrapper

Use PowerShell from the repo root:

```powershell
./tools/clawtok-api.ps1 -Command snapshot
./tools/clawtok-api.ps1 -Command action -Action 'import.create' -InputJson '{"url":"https://www.tiktok.com/@user/video/123","source":"telegram"}'
./tools/clawtok-api.ps1 -Command action -Action 'note.search' -InputJson '{"query":"cursor"}'
```

## UTF-8 Safety

- Windows shell hops can corrupt raw non-ASCII text inside command arguments.
- If you pass user text with accents or other non-ASCII characters inside `InputJson`, use unicode escapes.
- Do not drop accents or punctuation for compatibility reasons.

## Available Actions

- `import.create`
- `job.retry`
- `note.search`
- `note.delete`

## Reply Style

- Prefer Spanish.
- Keep the answer concise.
- Mention the note title, current status, and whether the analysis is partial when relevant.
