import { loadEnvConfig } from '@next/env'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import { getEnv } from '../lib/env'
import {
  appendJobLog,
  claimNextImportJob,
  completeImportJob,
  computeConfidenceScore,
  createFolder,
  failImportJob,
  getAllFolders,
  getImportJob,
  setImportJobStage,
} from '../lib/server/clawtok-service'
import type { ClawtokAnalysis, GlosarioItem, TikTokFuente } from '../lib/types'

loadEnvConfig(process.cwd())

const execFileAsync = promisify(execFile)
let resolvedOpenClawInvocation:
  | { command: string; prefixArgs: string[]; useShell: boolean }
  | null = null

const acquisitionSchema = z.object({
  author: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  comments: z
    .array(
      z.object({
        autor: z.string().nullable().optional(),
        likes: z.number().nullable().optional(),
        texto: z.string().min(1),
      })
    )
    .max(100)
    .default([]),
  durationLabel: z.string().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
  finalUrl: z.string().nullable().optional(),
  hashtags: z.array(z.string()).default([]),
  metadatosConfirmados: z.array(z.string()).default([]),
  metricas: z
    .object({
      comentarios: z.string().nullable().optional(),
      compartidos: z.string().nullable().optional(),
      guardados: z.string().nullable().optional(),
      likes: z.string().nullable().optional(),
      reproducciones: z.string().nullable().optional(),
    })
    .optional(),
  partial: z.boolean().default(false),
  partialReasons: z.array(z.string()).default([]),
  publishedAt: z.string().nullable().optional(),
  technicalLog: z.array(z.string()).default([]),
  transcript: z.string().nullable().optional(),
  videoPath: z.string().nullable().optional(),
  visualSummary: z.string().nullable().optional(),
})

const synthesisSchema = z.object({
  actionsToTry: z.array(z.string()).default([]),
  commentSignals: z.array(z.string()).default([]),
  confidence: z.enum(['alto', 'medio', 'bajo']).default('medio'),
  confirmedFacts: z.array(z.string()).default([]),
  glossary: z
    .array(
      z.object({
        definicion: z.string().min(1),
        termino: z.string().min(1),
      })
    )
    .default([]),
  inferredSignals: z.array(z.string()).default([]),
  mainIdea: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string()).default([]),
  title: z.string().min(1),
  toolsMentioned: z.array(z.string()).default([]),
  usefulness: z.string().min(1),
  keyPoints: z.array(z.string()).default([]),
})

const folderDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('use_existing'),
    folderId: z.string(),
  }),
  z.object({
    action: z.literal('create_new'),
    name: z.string().max(30),
    icon: z.string().max(8),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
])

type AcquisitionResult = z.infer<typeof acquisitionSchema>
type SynthesisResult = z.infer<typeof synthesisSchema>
type FolderDecision = z.infer<typeof folderDecisionSchema>

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readFlag(flag: string) {
  return process.argv.includes(flag)
}

function extractJsonPayload(text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('OpenClaw returned an empty payload')
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  throw new Error(`Could not extract JSON from OpenClaw payload: ${trimmed}`)
}

async function canAccess(pathname: string) {
  try {
    await fs.access(pathname)
    return true
  } catch {
    return false
  }
}

async function resolveOpenClawInvocation() {
  if (resolvedOpenClawInvocation) {
    return resolvedOpenClawInvocation
  }

  const explicit = process.env.OPENCLAW_BIN?.trim()
  if (explicit) {
    resolvedOpenClawInvocation = {
      command: explicit,
      prefixArgs: [],
      useShell: process.platform === 'win32',
    }
    return resolvedOpenClawInvocation
  }

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA
    const userProfile = process.env.USERPROFILE
    const scriptCandidates = [
      appData ? path.join(appData, 'npm', 'node_modules', 'openclaw', 'openclaw.mjs') : null,
      userProfile
        ? path.join(
            userProfile,
            'AppData',
            'Roaming',
            'npm',
            'node_modules',
            'openclaw',
            'openclaw.mjs'
          )
        : null,
    ].filter((candidate): candidate is string => Boolean(candidate))

    for (const candidate of scriptCandidates) {
      if (await canAccess(candidate)) {
        resolvedOpenClawInvocation = {
          command: process.execPath,
          prefixArgs: [candidate],
          useShell: false,
        }
        return resolvedOpenClawInvocation
      }
    }

    const candidates = [
      appData ? path.join(appData, 'npm', 'openclaw.cmd') : null,
      userProfile
        ? path.join(userProfile, 'AppData', 'Roaming', 'npm', 'openclaw.cmd')
        : null,
      'openclaw.cmd',
      'openclaw',
    ].filter((candidate): candidate is string => Boolean(candidate))

    for (const candidate of candidates) {
      if (
        candidate === 'openclaw.cmd' ||
        candidate === 'openclaw' ||
        (await canAccess(candidate))
      ) {
        resolvedOpenClawInvocation = {
          command: candidate,
          prefixArgs: [],
          useShell: candidate.endsWith('.cmd'),
        }
        return resolvedOpenClawInvocation
      }
    }
  }

  resolvedOpenClawInvocation = {
    command: 'openclaw',
    prefixArgs: [],
    useShell: false,
  }
  return resolvedOpenClawInvocation
}

async function runAgentJson<T>(message: string, schema: z.ZodSchema<T>) {
  const env = getEnv()
  const invocation = await resolveOpenClawInvocation()
  const args = [
    ...invocation.prefixArgs,
    'agent',
    '--agent',
    env.OPENCLAW_WORKER_AGENT_ID,
    '--json',
    '--timeout',
    String(env.OPENCLAW_WORKER_TIMEOUT_SECONDS),
    '--message',
    message,
  ]

  const { stdout, stderr } = await execFileAsync(invocation.command, args, {
    cwd: process.cwd(),
    maxBuffer: 20 * 1024 * 1024,
    shell: invocation.useShell,
  })

  if (stderr?.trim()) {
    console.error(stderr.trim())
  }

  const payload = JSON.parse(stdout) as {
    result?: {
      payloads?: Array<{ text?: string | null }>
    }
    status?: string
  }

  if (payload.status !== 'ok') {
    throw new Error(`OpenClaw agent failed with status ${payload.status ?? 'unknown'}`)
  }

  const text =
    payload.result?.payloads?.map((item) => item.text ?? '').join('\n').trim() ?? ''
  const jsonText = extractJsonPayload(text)
  const parsed = JSON.parse(jsonText) as unknown
  return schema.parse(parsed)
}

function buildAcquisitionPrompt(job: { id: string; sourceUrl: string }, tempDir: string) {
  return `
WORKER MODE.
You are processing one ClawTok acquisition job.
Return ONLY valid JSON. No markdown, no prose, no code fences.

Job id: ${job.id}
TikTok URL: ${job.sourceUrl}
Temporary directory: ${tempDir}

Requirements:
1. Open the TikTok URL in the browser as an authenticated user if a valid session is available.
2. Wait until the page is fully usable.
3. Extract confirmed metadata:
   - final URL
   - author
   - caption
   - visible duration if present
   - visible date if present
   - hashtags
   - visible metrics if present
4. Read a useful visible sample of comments. Aim for 50 to 100 comments if possible, but return fewer if access is limited.
5. Try to obtain a processable representation of the video.
   - If you can save anything locally, use ONLY the provided temporary directory.
   - If you cannot save the video, continue with partial analysis.
6. If you can confirm the video duration, return it because ClawTok uses it to estimate the processing ETA.
7. Distinguish confirmed facts from inference.
8. If any step fails, do not abort the whole job if enough context remains.

JSON schema:
{
  "author": "string | null",
  "caption": "string | null",
  "comments": [{ "autor": "string | null", "likes": "number | null", "texto": "string" }],
  "durationLabel": "string | null",
  "durationSeconds": "number | null",
  "finalUrl": "string | null",
  "hashtags": ["string"],
  "metadatosConfirmados": ["string"],
  "metricas": {
    "comentarios": "string | null",
    "compartidos": "string | null",
    "guardados": "string | null",
    "likes": "string | null",
    "reproducciones": "string | null"
  },
  "partial": true,
  "partialReasons": ["string"],
  "publishedAt": "string | null",
  "technicalLog": ["string"],
  "transcript": "string | null",
  "videoPath": "string | null",
  "visualSummary": "string | null"
}
`.trim()
}

function buildSynthesisPrompt(
  job: { id: string; sourceUrl: string },
  acquisition: AcquisitionResult
) {
  return `
WORKER MODE.
You are processing one ClawTok understanding job.
Return ONLY valid JSON. No markdown, no prose, no code fences.

Job id: ${job.id}
Original URL: ${job.sourceUrl}

Priorities:
1. Audio or transcript
2. Relevant visual content
3. Caption and hashtags
4. Visible comments
5. Visible metrics

Rules:
1. Do NOT output a raw transcription.
2. Convert the TikTok into a reusable note.
3. Distinguish confirmed facts from inference.
4. If the acquisition was partial, preserve that uncertainty.
5. Keep the output concise but practical.

Acquisition JSON:
${JSON.stringify(acquisition, null, 2)}

JSON schema:
{
  "title": "string",
  "summary": "string",
  "mainIdea": "string",
  "keyPoints": ["string"],
  "glossary": [{ "termino": "string", "definicion": "string" }],
  "toolsMentioned": ["string"],
  "actionsToTry": ["string"],
  "commentSignals": ["string"],
  "confirmedFacts": ["string"],
  "inferredSignals": ["string"],
  "confidence": "alto | medio | bajo",
  "tags": ["string"],
  "usefulness": "string"
}
`.trim()
}

function buildAnalysis(result: SynthesisResult): ClawtokAnalysis {
  return {
    accionesSugeridas: result.actionsToTry,
    hechosConfirmados: result.confirmedFacts,
    ideaPrincipal: result.mainIdea,
    inferencias: result.inferredSignals,
    herramientasMencionadas: result.toolsMentioned,
    nivelConfianza: result.confidence,
    senalesComentarios: result.commentSignals,
  }
}

function buildSource(acquisition: AcquisitionResult, analysis: ClawtokAnalysis): TikTokFuente {
  return {
    autor: acquisition.author ?? null,
    caption: acquisition.caption ?? null,
    fechaVisible: acquisition.publishedAt ?? null,
    finalUrl: acquisition.finalUrl ?? null,
    hashtags: acquisition.hashtags,
    metadatosConfirmados: Array.from(
      new Set([...acquisition.metadatosConfirmados, ...analysis.hechosConfirmados])
    ).slice(0, 20),
    metricas: acquisition.metricas,
  }
}

function pickThumbnail(acquisition: AcquisitionResult) {
  const videoPath = acquisition.videoPath ?? null
  if (videoPath && /^https?:\/\//.test(videoPath)) {
    return videoPath
  }

  return null
}

async function cleanTempDir(tempDir: string) {
  await fs.rm(tempDir, { force: true, recursive: true })
}

function slugifyFolderName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36) || 'carpeta'
  )
}

function buildFolderDecisionPrompt(
  note: { title: string; summary: string; tags: string[]; tools: string[] },
  existingFolders: { id: string; nombre: string; icono: string }[]
): string {
  const folderList =
    existingFolders.length > 0
      ? existingFolders
          .filter((f) => f.id !== 'otros')
          .map((f) => `  - id: "${f.id}", name: "${f.nombre}", icon: "${f.icono}"`)
          .join('\n')
      : '  (no folders yet — always create_new)'

  return `
WORKER MODE.
You are a folder classifier for a personal TikTok knowledge library. Return ONLY valid JSON.

Your job: decide whether this note belongs in an existing folder or needs a brand-new one.

## Note to classify
Title: ${note.title}
Summary: ${note.summary}
Tags: ${note.tags.join(', ') || 'none'}
Tools mentioned: ${note.tools.join(', ') || 'none'}

## Existing folders
${folderList}

## Rules
1. Assign to an existing folder only if it is a clear, obvious match (same topic domain).
2. If there is no good match, create a new folder with a specific, descriptive name (1-3 words, in Spanish).
3. Never put content in "otros" — that folder is only a temporary placeholder.
4. New folder names must be specific (e.g., "Cocina Asiática", "Diseño UX", "Finanzas Personales").
5. Choose an emoji icon that best represents the folder topic.
6. Choose a color that is visually distinct from existing folder colors.

## Available emoji icons (pick ONE that fits best)
Tech & AI: 🤖 🧠 💡 ⚡ 🔮 💻 🖥️ 📱 🔧 ⚙️ 🌐 🚀 🛰️ 🔬 🧬 🔭
Code & Dev: 👨‍💻 📦 🧩 🗂️ 🖱️ ⌨️ 🛠️ 🔌 🐛 🐙
Design & Art: 🎨 🖌️ ✏️ 📐 🎭 🖼️ 🎬 📸 🎥 🎞️
Business & Money: 💼 📊 📈 💰 🏦 💳 📋 🤝 🏢 📣
Productivity: ✅ 📌 📅 🗓️ ⏱️ 🗃️ 📝 🔖 📎 🗒️
Food & Cooking: 🍳 🥘 🍕 🍜 🥗 🍰 🥑 ☕ 🍷 🍣 🥩 🥐 🍱
Health & Fitness: 💪 🏃 🧘 🏋️ ❤️ 🩺 🥗 🌿 💊 🏊
Science & Nature: 🌍 🌊 🌱 ⭐ 🌿 🦠 🧪 🌋 🌤️ 🐾
Travel & Places: ✈️ 🏠 🌴 🏔️ 🎒 🗺️ 🧳 🏕️ 🚗 🚢
Education: 📚 🎓 📖 🔤 🧩 🏫 ✍️ 📜 🧮
Gaming: 🎮 🕹️ 🎲 🏆 🎯 🃏 ♟️
Music & Audio: 🎵 🎶 🎸 🎹 🎙️ 🎤 🎧 🥁
Social & Lifestyle: 💬 👥 🤝 📣 🎉 🛍️ 💄 👗 👟
Ideas & Creativity: 💭 🌟 ✨ 🦋 🎠 🔑 🪄 🧿

## Available colors (pick ONE)
#6366f1 (indigo), #0ea5e9 (sky), #10b981 (emerald), #f59e0b (amber),
#8b5cf6 (violet), #ef4444 (red), #ec4899 (pink), #14b8a6 (teal),
#f97316 (orange), #84cc16 (lime), #06b6d4 (cyan), #a855f7 (purple),
#e11d48 (rose), #65a30d (green), #d97706 (yellow), #7c3aed (dark violet)

## JSON schema
If the note fits an existing folder:
{ "action": "use_existing", "folderId": "<existing folder id>" }

If a new folder is needed:
{ "action": "create_new", "name": "<folder name in Spanish>", "icon": "<single emoji>", "color": "<hex color>" }
`.trim()
}

async function inferAndCreateFolder(note: {
  title: string
  summary: string
  tags: string[]
  tools: string[]
}): Promise<string> {
  const existingFolders = await getAllFolders()
  const prompt = buildFolderDecisionPrompt(note, existingFolders)

  let decision: FolderDecision
  try {
    decision = await runAgentJson(prompt, folderDecisionSchema)
  } catch {
    // If AI fails, fall back to 'otros' instead of crashing the whole job.
    return 'otros'
  }

  if (decision.action === 'use_existing') {
    const exists = existingFolders.some((f) => f.id === decision.folderId)
    return exists ? decision.folderId : 'otros'
  }

  // Create a new folder.
  const slug = slugifyFolderName(decision.name)
  const alreadyExists = existingFolders.some((f) => f.id === slug)
  const newId = alreadyExists ? `${slug}-${crypto.randomUUID().slice(0, 6)}` : slug

  await createFolder({
    id: newId,
    nombre: decision.name,
    icono: decision.icon,
    color: decision.color,
  })

  return newId
}

async function processJob(jobId: string) {
  const claimedJob = await getImportJob(jobId)
  if (!claimedJob) {
    throw new Error(`Job ${jobId} disappeared`)
  }

  const tempDir = path.join(os.tmpdir(), 'clawtok', claimedJob.id)
  await fs.mkdir(tempDir, { recursive: true })

  let acquisition: AcquisitionResult | null = null
  let synthesis: SynthesisResult | null = null

  try {
    await appendJobLog(jobId, `Claimed job for ${claimedJob.sourceUrl}`)
    await setImportJobStage(jobId, {
      noteStatus: 'procesando',
      partial: false,
      stage: 'acquisition',
      tempDir,
    })

    acquisition = await runAgentJson(
      buildAcquisitionPrompt(claimedJob, tempDir),
      acquisitionSchema
    )

    for (const logLine of acquisition.technicalLog) {
      await appendJobLog(jobId, logLine)
    }

    await setImportJobStage(jobId, {
      acquisition,
      noteStatus: 'analizando',
      partial: acquisition.partial,
      stage: 'analysis',
      tempDir,
    })

    synthesis = await runAgentJson(
      buildSynthesisPrompt(claimedJob, acquisition),
      synthesisSchema
    )

    const analysis = buildAnalysis(synthesis)
    const source = buildSource(acquisition, analysis)

    await setImportJobStage(jobId, {
      acquisition,
      noteStatus: 'organizando',
      partial: acquisition.partial,
      stage: 'organizing',
      tempDir,
    })

    const folderId = await inferAndCreateFolder({
      title: synthesis.title,
      summary: synthesis.summary,
      tags: synthesis.tags,
      tools: synthesis.toolsMentioned,
    })
    const confidence = computeConfidenceScore(synthesis.confidence)

    await completeImportJob(jobId, {
      acquisition,
      analysis,
      commentsSummary: synthesis.commentSignals,
      confidence,
      folderId,
      glossary: synthesis.glossary as GlosarioItem[],
      keyPoints: synthesis.keyPoints,
      partial: acquisition.partial,
      result: {
        acquisition,
        synthesis,
      },
      source,
      summary: synthesis.summary,
      tags: Array.from(
        new Set(
          [...synthesis.tags, ...synthesis.toolsMentioned, ...acquisition.hashtags].map((tag) =>
            tag.replace(/^#/, '').trim().toLowerCase()
          )
        )
      ).filter(Boolean),
      thumbnailUrl: pickThumbnail(acquisition),
      title: synthesis.title,
      transcriptPartial: acquisition.transcript ?? null,
      usefulness: synthesis.usefulness,
    })

    await appendJobLog(jobId, 'Job completed successfully')
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown worker error'

    await appendJobLog(jobId, `Job failed: ${message}`)
    await failImportJob(jobId, {
      acquisition: acquisition ?? undefined,
      errorMessage: message,
      partial: acquisition?.partial ?? false,
      result:
        acquisition || synthesis
          ? { acquisition: acquisition ?? undefined, synthesis: synthesis ?? undefined }
          : undefined,
    })
    throw error
  } finally {
    await cleanTempDir(tempDir)
  }
}

async function workOnce() {
  const workerId = `${os.hostname()}:${process.pid}`
  const job = await claimNextImportJob(workerId)
  if (!job) {
    return false
  }

  await processJob(job.id)
  return true
}

async function main() {
  const once = readFlag('--once')

  if (once) {
    const processed = await workOnce()
    console.log(processed ? 'Processed one job.' : 'No pending jobs.')
    return
  }

  console.log('ClawTok worker started.')
  while (true) {
    const processed = await workOnce()
    if (!processed) {
      await sleep(5000)
    }
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
