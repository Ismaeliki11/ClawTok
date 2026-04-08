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
- When the backend returns an ETA, include the range and the approximate local ready time.
- If the ETA is provisional, say that clearly.
- If a job is partial, say so explicitly.
- If the backend is unreachable, say that clearly and stop.

## Mandatory Workflow

1. If the user asks about current state, fetch a snapshot first.
2. If the user sends a TikTok URL, call `import.create`.
3. If the user asks to retry a failed import, call `job.retry`.
4. If the user asks for the latest ETA of a concrete job, call `job.status`.
5. If the user asks to find an existing note, use `note.search`.
6. If the user asks to delete a note, confirm first and then call `note.delete`.
7. Report the real backend result, not the intended one.

## ETA Behaviour

- For new imports, prefer the ETA returned inside `result.job.estimacion`.
- If the estimate says `provisional: true`, explain that it will be refined after ClawTok sees the video duration.
- If the user is waiting, return the current stage, ETA range, and ready time window. Do not say only "pending".
- If there is no ETA in the backend payload, say that the estimate is not available yet instead of inventing one.

## Wrapper

Use PowerShell from the repo root:

```powershell
./tools/clawtok-api.ps1 -Command snapshot
./tools/clawtok-api.ps1 -Command action -Action 'import.create' -InputJson '{"url":"https://www.tiktok.com/@user/video/123","source":"telegram"}'
./tools/clawtok-api.ps1 -Command action -Action 'job.status' -InputJson '{"jobId":"123"}'
./tools/clawtok-api.ps1 -Command action -Action 'note.search' -InputJson '{"query":"cursor"}'
```

## UTF-8 Safety

- Windows shell hops can corrupt raw non-ASCII text inside command arguments.
- If you pass user text with accents or other non-ASCII characters inside `InputJson`, use unicode escapes.
- Do not drop accents or punctuation for compatibility reasons.

## Available Actions

- `import.create`
- `job.retry`
- `job.status`
- `note.search`
- `note.delete`

## Reply Style

- Prefer Spanish.
- Keep the answer concise.
- Mention the note title, current status, and whether the analysis is partial when relevant.
- When available, mention the ETA range and the approximate ready time in the same reply.
