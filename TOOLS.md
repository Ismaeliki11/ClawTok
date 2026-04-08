# TOOLS.md

## ClawTok Backend

- Main skill: `clawtok_backend`
- Local wrapper: `tools/clawtok-api.ps1`
- Base URL env: `OPENCLAW_CLAWTOK_BASE_URL`
- Agent key env: `OPENCLAW_CLAWTOK_AGENT_KEY`
- Source app repo: `C:\Users\ismae\Desktop\Paginas\clawtok`
- Agent workspace: `C:\Users\ismae\clawd-clawtok`

## Tooling Rules

- Do not expose secrets in replies.
- Do not improvise direct backend calls when the wrapper already covers the action.
- If the backend is unavailable, say so clearly and stop.
- Browser work during ingestion belongs to worker mode, not to casual chat replies.
- Use backend snapshot or `job.status` before reporting an ETA.
