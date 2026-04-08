import type { Client } from '@libsql/client'
import { getDb } from '@/lib/db/client'
import type {
  AgentSnapshot,
  AppSnapshot,
  Carpeta,
  ClawtokAnalysis,
  GlosarioItem,
  ImportEstimate,
  ImportacionReciente,
  Nota,
  ProcessingStatus,
  TikTokFuente,
} from '@/lib/types'
import { badRequest, notFound } from '@/lib/server/errors'

type DbTransaction = Awaited<ReturnType<Client['transaction']>>
type Executor = Pick<Client, 'execute'> | Pick<DbTransaction, 'execute'>
type DbRow = Record<string, unknown>

const ACTIVE_IMPORT_STATUSES = new Set<ProcessingStatus>([
  'pendiente',
  'procesando',
  'analizando',
  'organizando',
])

const MADRID_TIME_ZONE = 'Europe/Madrid'
const JOB_STAGE_LABELS: Record<string, string> = {
  acquisition: 'Revisando el TikTok',
  analysis: 'Analizando audio, visuales y comentarios',
  complete: 'Completado',
  failed: 'Bloqueado',
  organizing: 'Guardando la nota',
  queued: 'En cola',
}

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

function isActiveImportStatus(status: string): status is ProcessingStatus {
  return ACTIVE_IMPORT_STATUSES.has(status as ProcessingStatus)
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: MADRID_TIME_ZONE,
  }).format(date)
}

function formatMinutesWindow(minimo: number, maximo: number) {
  if (minimo === maximo) {
    return `${minimo} min`
  }

  return `${minimo}-${maximo} min`
}

function formatDuration(seconds: number) {
  if (seconds < 60) {
    return `${Math.max(1, Math.round(seconds))} s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)

  if (remainder === 0) {
    return `${minutes} min`
  }

  return `${minutes} min ${remainder} s`
}

function deriveStage(status: ProcessingStatus, rawStage?: string | null) {
  if (rawStage) {
    return rawStage
  }

  switch (status) {
    case 'pendiente':
      return 'queued'
    case 'procesando':
      return 'acquisition'
    case 'analizando':
      return 'analysis'
    case 'organizando':
      return 'organizing'
    case 'completado':
      return 'complete'
    case 'error':
      return 'failed'
    default:
      return 'queued'
  }
}

function readDurationDetails(row: DbRow) {
  const acquisition = safeJsonParse<Record<string, unknown>>(row.acquisition_json, {})
  const rawSeconds = acquisition.durationSeconds
  const durationSeconds =
    typeof rawSeconds === 'number' && Number.isFinite(rawSeconds) && rawSeconds > 0
      ? rawSeconds
      : typeof rawSeconds === 'string' && rawSeconds.trim()
        ? Number(rawSeconds)
        : null

  const durationLabel =
    typeof acquisition.durationLabel === 'string' && acquisition.durationLabel.trim().length > 0
      ? acquisition.durationLabel.trim()
      : durationSeconds && Number.isFinite(durationSeconds)
        ? formatDuration(durationSeconds)
        : null

  return {
    durationLabel,
    durationSeconds:
      durationSeconds && Number.isFinite(durationSeconds) && durationSeconds > 0
        ? durationSeconds
        : null,
  }
}

function estimateImport(row: DbRow, activeRows: DbRow[]): ImportEstimate | undefined {
  const status = readString(row, 'status') as ProcessingStatus
  const stage = deriveStage(status, readNullableString(row, 'stage'))
  const stageLabel = JOB_STAGE_LABELS[stage] ?? 'Procesando'

  if (!isActiveImportStatus(status)) {
    return undefined
  }

  const activeIds = activeRows.map((item) => readString(item, 'id'))
  const activeIndex = activeIds.indexOf(readString(row, 'id'))
  const colaDelante = activeIndex > 0 ? activeIndex : 0
  const { durationLabel, durationSeconds } = readDurationDetails(row)
  const videoMinutes = durationSeconds ? Math.min(Math.max(durationSeconds / 60, 0.25), 5) : 0.75

  let baseMin = 2
  let baseMax = 5

  switch (stage) {
    case 'queued':
      baseMin = 2.5 + videoMinutes * 0.4
      baseMax = 6 + videoMinutes * 0.8
      break
    case 'acquisition':
      baseMin = 1.5 + videoMinutes * 0.35
      baseMax = 4 + videoMinutes * 0.75
      break
    case 'analysis':
      baseMin = 1 + videoMinutes * 0.3
      baseMax = 3 + videoMinutes * 0.5
      break
    case 'organizing':
      baseMin = 1
      baseMax = 2
      break
    default:
      break
  }

  const minimo = Math.max(1, Math.ceil(baseMin + colaDelante * 3.5))
  const maximo = Math.max(minimo, Math.ceil(baseMax + colaDelante * 6))
  const provisional = durationSeconds == null
  const nowDate = new Date()
  const updatedAtText = readString(row, 'updated_at')
  const updatedAtDate = updatedAtText ? new Date(updatedAtText) : nowDate
  const sinActividadMinutos = Math.max(
    0,
    Math.floor((nowDate.getTime() - updatedAtDate.getTime()) / 60_000)
  )
  const thresholdMinutes =
    stage === 'queued' ? 10 : stage === 'organizing' ? 8 : 12
  const atascada = sinActividadMinutos >= thresholdMinutes
  const desdeDate = new Date(nowDate.getTime() + minimo * 60_000)
  const hastaDate = new Date(nowDate.getTime() + maximo * 60_000)
  const desdeLocal = formatClock(desdeDate)
  const hastaLocal = formatClock(hastaDate)

  const fragments = [`${stageLabel}.`]
  if (atascada) {
    if (stage === 'queued') {
      fragments.push(
        `Lleva ${sinActividadMinutos} min sin avanzar en cola; es probable que el worker no este corriendo.`
      )
    } else {
      fragments.push(
        `Lleva ${sinActividadMinutos} min sin actividad visible; puede haberse quedado atascada.`
      )
    }
  }
  if (colaDelante > 0) {
    fragments.push(
      `Hay ${colaDelante} importacion${colaDelante === 1 ? '' : 'es'} por delante.`
    )
  }
  if (durationLabel) {
    fragments.push(`Duracion detectada: ${durationLabel}.`)
  }
  fragments.push(`Calculo ${formatMinutesWindow(minimo, maximo)} restantes.`)
  fragments.push(`Aprox listo entre las ${desdeLocal} y las ${hastaLocal}.`)
  if (provisional) {
    fragments.push('La ETA se afinara cuando vea mejor el video.')
  }

  return {
    atascada,
    calculadoEn: nowDate.toISOString(),
    colaDelante,
    duracionVideoSegundos: durationSeconds,
    duracionVideoVisible: durationLabel,
    etapa: stage,
    etapaLabel: stageLabel,
    listoEntre: {
      desde: desdeDate.toISOString(),
      hasta: hastaDate.toISOString(),
      desdeLocal,
      hastaLocal,
    },
    mensaje: fragments.join(' '),
    minutosRestantes: {
      maximo,
      minimo,
    },
    provisional,
    sinActividadMinutos,
  }
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

function serializeImport(row: DbRow, activeRows: DbRow[]): ImportacionReciente {
  const status = readString(row, 'status') as ProcessingStatus

  return {
    estimacion: estimateImport(row, activeRows),
    id: readString(row, 'id'),
    notaId: readString(row, 'note_id'),
    actualizadoEn: readString(row, 'updated_at'),
    creadoEn: readString(row, 'created_at'),
    error: readNullableString(row, 'error_message'),
    estado: status,
    parcial: readNumber(row, 'partial') === 1,
    stage: deriveStage(status, readNullableString(row, 'stage')),
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
  const activeImportsResult = await executor.execute({
    sql: `
      SELECT *
      FROM import_jobs
      WHERE status IN ('pendiente', 'procesando', 'analizando', 'organizando')
      ORDER BY created_at ASC
    `,
  })

  const activeRows = activeImportsResult.rows.map((row) => asRow(row))

  return {
    carpetas: foldersResult.rows.map((row) => serializeFolder(asRow(row))),
    notas: notesResult.rows.map((row) => serializeNote(asRow(row))),
    importaciones: importsResult.rows.map((row) => serializeImport(asRow(row), activeRows)),
  }
}

export async function getAllFolders(): Promise<Carpeta[]> {
  const db = await getDb()
  const result = await db.execute('SELECT * FROM folders ORDER BY created_at ASC')
  return result.rows.map((row) => serializeFolder(asRow(row)))
}

export async function createFolder(data: {
  id: string
  nombre: string
  icono: string
  color: string
}): Promise<void> {
  const db = await getDb()
  const timestamp = now()
  await db.execute({
    sql: 'INSERT OR IGNORE INTO folders (id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [data.id, data.nombre, data.icono, data.color, timestamp],
  })
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

  const job = await getImportJobSummary(jobId)

  return { job, jobId, noteId }
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

async function getActiveImportRows(executor: Executor) {
  const result = await executor.execute({
    sql: `
      SELECT *
      FROM import_jobs
      WHERE status IN ('pendiente', 'procesando', 'analizando', 'organizando')
      ORDER BY created_at ASC
    `,
  })

  return result.rows.map((row) => asRow(row))
}

export async function getImportJobSummary(jobId: string) {
  const db = await getDb()
  const row = await getJobRow(db, jobId)

  if (!row) {
    return null
  }

  const activeRows = await getActiveImportRows(db)
  return serializeImport(row, activeRows)
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
