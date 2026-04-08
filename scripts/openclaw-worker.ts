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
  failImportJob,
  getImportJob,
  inferFolderId,
  setImportJobStage,
} from '../lib/server/clawtok-service'
import type { ClawtokAnalysis, GlosarioItem, TikTokFuente } from '../lib/types'

loadEnvConfig(process.cwd())

const execFileAsync = promisify(execFile)

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

type AcquisitionResult = z.infer<typeof acquisitionSchema>
type SynthesisResult = z.infer<typeof synthesisSchema>

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

async function runAgentJson<T>(message: string, schema: z.ZodSchema<T>) {
  const env = getEnv()
  const args = [
    'agent',
    '--agent',
    env.OPENCLAW_WORKER_AGENT_ID,
    '--json',
    '--timeout',
    String(env.OPENCLAW_WORKER_TIMEOUT_SECONDS),
    '--message',
    message,
  ]

  const { stdout, stderr } = await execFileAsync('openclaw', args, {
    cwd: process.cwd(),
    maxBuffer: 20 * 1024 * 1024,
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
   - visible date if present
   - hashtags
   - visible metrics if present
4. Read a useful visible sample of comments. Aim for 50 to 100 comments if possible, but return fewer if access is limited.
5. Try to obtain a processable representation of the video.
   - If you can save anything locally, use ONLY the provided temporary directory.
   - If you cannot save the video, continue with partial analysis.
6. Distinguish confirmed facts from inference.
7. If any step fails, do not abort the whole job if enough context remains.

JSON schema:
{
  "author": "string | null",
  "caption": "string | null",
  "comments": [{ "autor": "string | null", "likes": "number | null", "texto": "string" }],
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
    const folderId = inferFolderId({
      analysis,
      source,
      summary: synthesis.summary,
      title: synthesis.title,
    })
    const confidence = computeConfidenceScore(synthesis.confidence)

    await setImportJobStage(jobId, {
      acquisition,
      confidence,
      noteStatus: 'organizando',
      partial: acquisition.partial,
      result: synthesis,
      stage: 'organizing',
      tempDir,
    })

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
