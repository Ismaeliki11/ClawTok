# MEMORY.md

## Purpose

- ClawTok ingests TikTok links and turns them into reusable notes.
- The final output is not a transcript. It is a structured note with practical value.

## Current Architecture

- Public app/backend repo: `C:\Users\ismae\Desktop\Paginas\clawtok`
- OpenClaw workspace: `C:\Users\ismae\clawd-clawtok`
- Telegram bot account for this agent: `clawtok`
- Data store: Turso
- Public/backend entrypoint currently configured for the agent: `http://localhost:3000`
- Worker location: local PC running `npm run worker`

## Operating Rules

- Telegram/web requests create jobs in the backend.
- The local worker claims queued jobs and invokes the OpenClaw agent in worker mode.
- Acquisition and comprehension are separate phases.
- If video download, comments, audio, or TikTok auth fail, return a partial result instead of inventing data.

## Known Reality

- Localhost is fine for local testing, but production requires pointing the agent to the deployed Vercel URL.
- TikTok browser access may require Ismael to log in manually when the automated browser session is not authenticated.
