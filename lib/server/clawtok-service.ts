import type { Client } from '@libsql/client'
import { getDb } from '@/lib/db/client'
import type {
  AgentSnapshot,
  AppSnapshot,
  Carpeta,
  ClawtokAnalysis,
  GlosarioItem,
  ImportacionReciente,
  Nota,
  ProcessingStatus,
  TikTokFuente,
} from '@/lib/types'
import { badRequest, notFound } from '@/lib/server/errors'

type DbTransaction = Awaited<ReturnType<Client['transaction']>>
type Executor = Pick<Client, 'execute'> | Pick<DbTransaction, 'execute'>
type DbRow = Record<string, unknown>

export interface CreateImportInput {
  requestedBy?: string
  source: 'agent' | 'telegram' | 'web'
  sourceAccount?: string
  url: string
}

export interface ImportJobRecord {
  acquisition: Record<string, unknown>
  attempts: number
  confidence?: number | null
  completedAt?: string | null
  createdAt: string
  errorMessage?: string | null
  id: string
  lockedAt?: string | null
  lockedBy?: string | null
  logs: string[]
  noteId: string
  partial: boolean
  requesterHandle?: string | null
  requesterId?: string | null
  result: Record<string, unknown>
  sourceChannel: string
  sourceUrl: string
  stage?: string | null
  startedAt?: string | null
  status: ProcessingStatus
  tempDir?: string | null
  updatedAt: string
}

const now = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()

function asRow(row: unknown) {
  return row as DbRow
}

function readString(row: DbRow, key: string) {
  const value = row[key]
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function readNullableString(row: DbRow, key: string) {
  const value = row[key]
  if (value == null) {
    return null
  }

  return typeof value === 'string' ? value : String(value)
}

function readNumber(row: DbRow, key: string) {
  const value = row[key]
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'bigint') {
    return Number(value)
  }
  if (typeof value === 'string' && value.length > 0) {
    return Number(value)
  }
  return 0
}

function safeJsonParse<T>(value: unknown, fallback: T) {
  if (value == null) {
    return fallback
  }

  if (typeof value !== 'string') {
    return value as T
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

async function withWriteTransaction<T>(work: (tx: DbTransaction) => Promise<T>) {
  const db = await getDb()
  const tx = await db.transaction('write')

  try {
    const result = await work(tx)
    await tx.commit()
    return result
  } catch (error) {
    try {
      await tx.rollback()
    } catch {
      // Keep the original error.
    }

    throw error
  }
}

async function getNoteRow(executor: Executor, noteId: string) {
  const result = await executor.execute({
    sql: 'SELECT * FROM notes WHERE id = ? LIMIT 1',
    args: [noteId],
  })

  return result.rows[0] ? asRow(result.rows[0]) : null
}

async function getJobRow(executor: Executor, jobId: string) {
  const result = await executor.execute({
    sql: 'SELECT * FROM import_jobs WHERE id = ? LIMIT 1',
    args: [jobId],
  })

  return result.rows[0] ? asRow(result.rows[0]) : null
}

async function ensureNoteExists(executor: Executor, noteId: string) {
  const note = await getNoteRow(executor, noteId)
  if (!note) {
    throw notFound('Nota no encontrada')
  }

  return note
}

async function ensureJobExists(executor: Executor, jobId: string) {
  const job = await getJobRow(executor, jobId)
  if (!job) {
    throw notFound('Importacion no encontrada')
  }

  return job
}

function normalizeGlossary(value: unknown) {
  const list = safeJsonParse<GlosarioItem[]>(value, [])
  return Array.isArray(list) ? list : []
}

function normalizeStringArray(value: unknown) {
  const list = safeJsonParse<string[]>(value, [])
  return Array.isArray(list) ? list.filter((item) => typeof item === 'string') : []
}

function serializeNote(row: DbRow): Nota {
  const source = safeJsonParse<TikTokFuente | undefined>(row.source_json, undefined)
  const analysis = safeJsonParse<ClawtokAnalysis | undefined>(
    row.analysis_json,
    undefined
  )

  return {
    id: readString(row, 'id'),
    tiktokUrl: readString(row, 'tiktok_url'),
    titulo: readString(row, 'title'),
    carpetaId: readString(row, 'folder_id'),
    resumen: readString(row, 'summary'),
    glosario: normalizeGlossary(row.glossary_json),
    puntosClave: normalizeStringArray(row.key_points_json),
    utilidad: readString(row, 'usefulness'),
    comentariosDestilados: normalizeStringArray(row.comments_summary_json),
    etiquetas: normalizeStringArray(row.tags_json),
    creadoEn: readString(row, 'created_at'),
    actualizadoEn: readString(row, 'updated_at'),
    estadoProcesado: readString(row, 'processing_status') as ProcessingStatus,
    miniatura: readNullableString(row, 'thumbnail_url') ?? undefined,
    transcriptParcial: readNullableString(row, 'transcript_partial') ?? undefined,
    notaPersonal: readNullableString(row, 'personal_note') ?? undefined,
    analisis: analysis,
    analisisParcial: readNumber(row, 'partial') === 1,
    comentariosMuestra: undefined,
    fuente: source,
  }
}

function serializeImport(row: DbRow): ImportacionReciente {
  return {
    id: readString(row, 'id'),
    notaId: readString(row, 'note_id'),
    actualizadoEn: readString(row, 'updated_at'),
    creadoEn: readString(row, 'created_at'),
    error: readNullableString(row, 'error_message'),
    estado: readString(row, 'status') as ProcessingStatus,
    parcial: readNumber(row, 'partial') === 1,
    url: readString(row, 'source_url'),
  }
}

function serializeFolder(row: DbRow): Carpeta {
  return {
    id: readString(row, 'id'),
    nombre: readString(row, 'name'),
    icono: readString(row, 'icon'),
    color: readString(row, 'color'),
    creadoEn: readString(row, 'created_at'),
  }
}

function serializeJobRecord(row: DbRow): ImportJobRecord {
  return {
    acquisition: safeJsonParse<Record<string, unknown>>(row.acquisition_json, {}),
    attempts: readNumber(row, 'attempts'),
    confidence:
      row.confidence == null ? null : Number(readNumber(row, 'confidence')),
    completedAt: readNullableString(row, 'completed_at'),
    createdAt: readString(row, 'created_at'),
    errorMessage: readNullableString(row, 'error_message'),
    id: readString(row, 'id'),
    lockedAt: readNullableString(row, 'locked_at'),
    lockedBy: readNullableString(row, 'locked_by'),
    logs: normalizeStringArray(row.logs_json),
    noteId: readString(row, 'note_id'),
    partial: readNumber(row, 'partial') === 1,
    requesterHandle: readNullableString(row, 'requester_handle'),
    requesterId: readNullableString(row, 'requester_id'),
    result: safeJsonParse<Record<string, unknown>>(row.result_json, {}),
    sourceChannel: readString(row, 'source_channel'),
    sourceUrl: readString(row, 'source_url'),
    stage: readNullableString(row, 'stage'),
    startedAt: readNullableString(row, 'started_at'),
    status: readString(row, 'status') as ProcessingStatus,
    tempDir: readNullableString(row, 'temp_dir'),
    updatedAt: readString(row, 'updated_at'),
  }
}

async function readSnapshotFromExecutor(executor: Executor): Promise<AppSnapshot> {
  const foldersResult = await executor.execute({
    sql: 'SELECT * FROM folders ORDER BY name COLLATE NOCASE ASC',
  })
  const notesResult = await executor.execute({
    sql: 'SELECT * FROM notes ORDER BY created_at DESC',
  })
  const importsResult = await executor.execute({
    sql: 'SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 25',
  })

  return {
    carpetas: foldersResult.rows.map((row) => serializeFolder(asRow(row))),
    notas: notesResult.rows.map((row) => serializeNote(asRow(row))),
    importaciones: importsResult.rows.map((row) => serializeImport(asRow(row))),
  }
}

export async function getAppSnapshot(): Promise<AppSnapshot> {
  const db = await getDb()
  return readSnapshotFromExecutor(db)
}

export async function getAgentSnapshot(): Promise<AgentSnapshot> {
  const snapshot = await getAppSnapshot()
  return {
    carpetas: snapshot.carpetas,
    notasEnProceso: snapshot.importaciones.filter(
      (item) => item.estado !== 'completado' && item.estado !== 'error'
    ),
    notasRecientes: snapshot.notas
      .filter((note) => note.estadoProcesado === 'completado')
      .slice(0, 10),
  }
}

export async function createImportJob(input: CreateImportInput) {
  const noteId = uuid()
  const jobId = uuid()
  const timestamp = now()

  await withWriteTransaction(async (tx) => {
    await tx.execute({
      sql: `
        INSERT INTO notes (
          id,
          job_id,
          folder_id,
          tiktok_url,
          title,
          summary,
          glossary_json,
          key_points_json,
          usefulness,
          comments_summary_json,
          tags_json,
          source_json,
          analysis_json,
          processing_status,
          partial,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        noteId,
        jobId,
        'otros',
        input.url,
        'Procesando...',
        '',
        '[]',
        '[]',
        '',
        '[]',
        '[]',
        '{}',
        '{}',
        'pendiente',
        0,
        timestamp,
        timestamp,
      ],
    })

    await tx.execute({
      sql: `
        INSERT INTO import_jobs (
          id,
          note_id,
          source_url,
          source_channel,
          requester_id,
          requester_handle,
          status,
          stage,
          partial,
          acquisition_json,
          result_json,
          logs_json,
          attempts,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        jobId,
        noteId,
        input.url,
        input.source,
        input.sourceAccount ?? null,
        input.requestedBy ?? null,
        'pendiente',
        'queued',
        0,
        '{}',
        '{}',
        JSON.stringify([`Job created from ${input.source}`]),
        0,
        timestamp,
        timestamp,
      ],
    })
  })

  return { jobId, noteId }
}

export async function updateNoteFields(
  noteId: string,
  input: { notaPersonal?: string; title?: string }
) {
  await withWriteTransaction(async (tx) => {
    const note = await ensureNoteExists(tx, noteId)
    const nextTitle =
      input.title === undefined ? readString(note, 'title') : input.title
    const nextPersonalNote =
      input.notaPersonal === undefined
        ? readNullableString(note, 'personal_note')
        : input.notaPersonal

    await tx.execute({
      sql: `
        UPDATE notes
        SET title = ?, personal_note = ?, updated_at = ?
        WHERE id = ?
      `,
      args: [nextTitle, nextPersonalNote ?? null, now(), noteId],
    })
  })
}

export async function deleteNoteById(noteId: string) {
  await withWriteTransaction(async (tx) => {
    await ensureNoteExists(tx, noteId)
    await tx.execute({ sql: 'DELETE FROM import_jobs WHERE note_id = ?', args: [noteId] })
    await tx.execute({ sql: 'DELETE FROM notes WHERE id = ?', args: [noteId] })
  })
}

export async function retryImportJob(jobId: string) {
  await withWriteTransaction(async (tx) => {
    const job = await ensureJobExists(tx, jobId)
    const noteId = readString(job, 'note_id')
    const timestamp = now()

    await tx.execute({
      sql: `
        UPDATE import_jobs
        SET
          status = 'pendiente',
          stage = 'queued',
          partial = 0,
          confidence = NULL,
          error_message = NULL,
          acquisition_json = '{}',
          result_json = '{}',
          temp_dir = NULL,
          locked_by = NULL,
          locked_at = NULL,
          started_at = NULL,
          completed_at = NULL,
          updated_at = ?
        WHERE id = ?
      `,
      args: [timestamp, jobId],
    })

    await tx.execute({
      sql: `
        UPDATE notes
        SET
          processing_status = 'pendiente',
          summary = '',
          usefulness = '',
          comments_summary_json = '[]',
          key_points_json = '[]',
          glossary_json = '[]',
          tags_json = '[]',
          source_json = '{}',
          analysis_json = '{}',
          transcript_partial = NULL,
          thumbnail_url = NULL,
          partial = 0,
          confidence = NULL,
          updated_at = ?
        WHERE id = ?
      `,
      args: [timestamp, noteId],
    })
  })
}

export async function searchNotes(query: string, limit = 5) {
  const snapshot = await getAppSnapshot()
  const normalized = query.toLowerCase().trim()

  if (!normalized) {
    return []
  }

  return snapshot.notas
    .filter((note) => note.estadoProcesado === 'completado')
    .filter((note) => {
      const haystack = [
        note.titulo,
        note.resumen,
        note.utilidad,
        ...note.etiquetas,
        ...note.puntosClave,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalized)
    })
    .slice(0, limit)
}

export async function appendJobLog(jobId: string, message: string) {
  await withWriteTransaction(async (tx) => {
    const job = await ensureJobExists(tx, jobId)
    const logs = normalizeStringArray(job.logs_json)
    logs.push(`[${now()}] ${message}`)

    await tx.execute({
      sql: 'UPDATE import_jobs SET logs_json = ?, updated_at = ? WHERE id = ?',
      args: [JSON.stringify(logs.slice(-100)), now(), jobId],
    })
  })
}

export async function claimNextImportJob(workerId: string) {
  return withWriteTransaction(async (tx) => {
    const result = await tx.execute({
      sql: `
        SELECT *
        FROM import_jobs
        WHERE status = 'pendiente'
        ORDER BY created_at ASC
        LIMIT 1
      `,
    })

    const row = result.rows[0] ? asRow(result.rows[0]) : null
    if (!row) {
      return null
    }

    const jobId = readString(row, 'id')
    const noteId = readString(row, 'note_id')
    const timestamp = now()

    await tx.execute({
      sql: `
        UPDATE import_jobs
        SET
          status = 'procesando',
          stage = 'acquisition',
          attempts = attempts + 1,
          locked_by = ?,
          locked_at = ?,
          started_at = COALESCE(started_at, ?),
          updated_at = ?
        WHERE id = ?
      `,
      args: [workerId, timestamp, timestamp, timestamp, jobId],
    })

    await tx.execute({
      sql: `
        UPDATE notes
        SET processing_status = 'procesando', updated_at = ?
        WHERE id = ?
      `,
      args: [timestamp, noteId],
    })

    const updatedJob = await ensureJobExists(tx, jobId)
    return serializeJobRecord(updatedJob)
  })
}

export async function getImportJob(jobId: string) {
  const db = await getDb()
  const row = await getJobRow(db, jobId)
  return row ? serializeJobRecord(row) : null
}

export async function setImportJobStage(
  jobId: string,
  input: {
    acquisition?: Record<string, unknown>
    confidence?: number | null
    noteStatus: ProcessingStatus
    partial?: boolean
    result?: Record<string, unknown>
    stage: string
    tempDir?: string | null
  }
) {
  await withWriteTransaction(async (tx) => {
    const job = await ensureJobExists(tx, jobId)
    const noteId = readString(job, 'note_id')
    const timestamp = now()
    const currentAcquisition = safeJsonParse<Record<string, unknown>>(
      job.acquisition_json,
      {}
    )
    const currentResult = safeJsonParse<Record<string, unknown>>(job.result_json, {})

    await tx.execute({
      sql: `
        UPDATE import_jobs
        SET
          status = ?,
          stage = ?,
          partial = ?,
          confidence = ?,
          acquisition_json = ?,
          result_json = ?,
          temp_dir = ?,
          updated_at = ?
        WHERE id = ?
      `,
      args: [
        input.noteStatus,
        input.stage,
        input.partial ? 1 : 0,
        input.confidence ?? null,
        JSON.stringify(input.acquisition ?? currentAcquisition),
        JSON.stringify(input.result ?? currentResult),
        input.tempDir ?? readNullableString(job, 'temp_dir'),
        timestamp,
        jobId,
      ],
    })

    await tx.execute({
      sql: `
        UPDATE notes
        SET
          processing_status = ?,
          partial = ?,
          confidence = ?,
          updated_at = ?
        WHERE id = ?
      `,
      args: [
        input.noteStatus,
        input.partial ? 1 : 0,
        input.confidence ?? null,
        timestamp,
        noteId,
      ],
    })
  })
}

export async function completeImportJob(
  jobId: string,
  input: {
    acquisition: Record<string, unknown>
    analysis: ClawtokAnalysis
    commentsSummary: string[]
    confidence?: number | null
    folderId: string
    glossary: GlosarioItem[]
    partial: boolean
    result: Record<string, unknown>
    summary: string
    tags: string[]
    thumbnailUrl?: string | null
    title: string
    transcriptPartial?: string | null
    usefulness: string
    source: TikTokFuente
    keyPoints: string[]
  }
) {
  await withWriteTransaction(async (tx) => {
    const job = await ensureJobExists(tx, jobId)
    const noteId = readString(job, 'note_id')
    const timestamp = now()

    await tx.execute({
      sql: `
        UPDATE notes
        SET
          folder_id = ?,
          title = ?,
          summary = ?,
          glossary_json = ?,
          key_points_json = ?,
          usefulness = ?,
          comments_summary_json = ?,
          tags_json = ?,
          source_json = ?,
          analysis_json = ?,
          processing_status = 'completado',
          thumbnail_url = ?,
          transcript_partial = ?,
          partial = ?,
          confidence = ?,
          updated_at = ?
        WHERE id = ?
      `,
      args: [
        input.folderId,
        input.title,
        input.summary,
        JSON.stringify(input.glossary),
        JSON.stringify(input.keyPoints),
        input.usefulness,
        JSON.stringify(input.commentsSummary),
        JSON.stringify(input.tags),
        JSON.stringify(input.source),
        JSON.stringify(input.analysis),
        input.thumbnailUrl ?? null,
        input.transcriptPartial ?? null,
        input.partial ? 1 : 0,
        input.confidence ?? null,
        timestamp,
        noteId,
      ],
    })

    await tx.execute({
      sql: `
        UPDATE import_jobs
        SET
          status = 'completado',
          stage = 'complete',
          partial = ?,
          confidence = ?,
          acquisition_json = ?,
          result_json = ?,
          completed_at = ?,
          updated_at = ?,
          locked_by = NULL,
          locked_at = NULL
        WHERE id = ?
      `,
      args: [
        input.partial ? 1 : 0,
        input.confidence ?? null,
        JSON.stringify(input.acquisition),
        JSON.stringify(input.result),
        timestamp,
        timestamp,
        jobId,
      ],
    })
  })
}

export async function failImportJob(
  jobId: string,
  input: {
    acquisition?: Record<string, unknown>
    errorMessage: string
    partial: boolean
    result?: Record<string, unknown>
  }
) {
  await withWriteTransaction(async (tx) => {
    const job = await ensureJobExists(tx, jobId)
    const noteId = readString(job, 'note_id')
    const timestamp = now()
    const fallbackAcquisition = safeJsonParse<Record<string, unknown>>(
      job.acquisition_json,
      {}
    )
    const fallbackResult = safeJsonParse<Record<string, unknown>>(job.result_json, {})

    await tx.execute({
      sql: `
        UPDATE import_jobs
        SET
          status = 'error',
          stage = 'failed',
          partial = ?,
          error_message = ?,
          acquisition_json = ?,
          result_json = ?,
          completed_at = ?,
          updated_at = ?,
          locked_by = NULL,
          locked_at = NULL
        WHERE id = ?
      `,
      args: [
        input.partial ? 1 : 0,
        input.errorMessage,
        JSON.stringify(input.acquisition ?? fallbackAcquisition),
        JSON.stringify(input.result ?? fallbackResult),
        timestamp,
        timestamp,
        jobId,
      ],
    })

    await tx.execute({
      sql: `
        UPDATE notes
        SET processing_status = 'error', partial = ?, updated_at = ?
        WHERE id = ?
      `,
      args: [input.partial ? 1 : 0, timestamp, noteId],
    })
  })
}

function scoreFolder(folderId: string, haystack: string) {
  const rules: Record<string, string[]> = {
    herramientas: ['tool', 'herramienta', 'app', 'software', 'plugin'],
    ia: ['ia', 'ai', 'gpt', 'claude', 'llm', 'openai', 'cursor', 'copilot'],
    ideas: ['idea', 'startup', 'brainstorm', 'concepto'],
    productividad: ['notion', 'obsidian', 'gtd', 'productividad', 'workflow'],
    programacion: ['codigo', 'code', 'developer', 'programacion', 'python', 'api'],
    recetas: ['receta', 'cocina', 'ingrediente'],
    web: ['css', 'html', 'react', 'tailwind', 'frontend', 'web', 'next.js'],
  }

  return (rules[folderId] ?? []).reduce((score, token) => {
    return haystack.includes(token) ? score + 1 : score
  }, 0)
}

export function inferFolderId(input: {
  analysis: ClawtokAnalysis
  source: TikTokFuente
  summary: string
  title: string
}) {
  const haystack = [
    input.title,
    input.summary,
    input.source.caption ?? '',
    ...input.analysis.herramientasMencionadas,
    ...input.source.hashtags,
  ]
    .join(' ')
    .toLowerCase()

  const ranked = (
    ['ia', 'web', 'programacion', 'herramientas', 'productividad', 'recetas', 'ideas'] as const
  )
    .map((folderId) => ({ folderId, score: scoreFolder(folderId, haystack) }))
    .sort((left, right) => right.score - left.score)

  return ranked[0]?.score ? ranked[0].folderId : 'otros'
}

export function computeConfidenceScore(level: 'alto' | 'medio' | 'bajo' | null | undefined) {
  switch (level) {
    case 'alto':
      return 0.9
    case 'medio':
      return 0.65
    case 'bajo':
      return 0.35
    default:
      return null
  }
}

export function ensureTikTokUrl(url: string) {
  try {
    const parsed = new URL(url)
    if (
      !parsed.hostname.includes('tiktok.com') &&
      !parsed.hostname.includes('vm.tiktok.com')
    ) {
      throw new Error('URL is not from TikTok')
    }

    return parsed.toString()
  } catch {
    throw badRequest('Introduce un enlace valido de TikTok')
  }
}

export function buildImportLogContext(job: ImportJobRecord) {
  return {
    attempts: job.attempts,
    jobId: job.id,
    noteId: job.noteId,
    sourceChannel: job.sourceChannel,
    sourceUrl: job.sourceUrl,
  }
}
