import type { Client, InStatement } from '@libsql/client'
import { DEFAULT_FOLDERS } from '@/lib/default-folders'

const SCHEMA_STATEMENTS: InStatement[] = [
  {
    sql: `
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `,
  },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        job_id TEXT UNIQUE,
        folder_id TEXT NOT NULL,
        tiktok_url TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        glossary_json TEXT NOT NULL DEFAULT '[]',
        key_points_json TEXT NOT NULL DEFAULT '[]',
        usefulness TEXT NOT NULL DEFAULT '',
        comments_summary_json TEXT NOT NULL DEFAULT '[]',
        tags_json TEXT NOT NULL DEFAULT '[]',
        source_json TEXT NOT NULL DEFAULT '{}',
        analysis_json TEXT NOT NULL DEFAULT '{}',
        processing_status TEXT NOT NULL DEFAULT 'pendiente',
        thumbnail_url TEXT,
        transcript_partial TEXT,
        personal_note TEXT,
        partial INTEGER NOT NULL DEFAULT 0,
        confidence REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE RESTRICT
      )
    `,
  },
  { sql: 'CREATE INDEX IF NOT EXISTS idx_notes_folder_status ON notes(folder_id, processing_status)' },
  { sql: 'CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC)' },
  {
    sql: `
      CREATE TABLE IF NOT EXISTS import_jobs (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL UNIQUE,
        source_url TEXT NOT NULL,
        source_channel TEXT NOT NULL DEFAULT 'web',
        requester_id TEXT,
        requester_handle TEXT,
        status TEXT NOT NULL DEFAULT 'pendiente',
        stage TEXT,
        partial INTEGER NOT NULL DEFAULT 0,
        confidence REAL,
        error_message TEXT,
        acquisition_json TEXT NOT NULL DEFAULT '{}',
        result_json TEXT NOT NULL DEFAULT '{}',
        logs_json TEXT NOT NULL DEFAULT '[]',
        temp_dir TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        locked_by TEXT,
        locked_at TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
      )
    `,
  },
  { sql: 'CREATE INDEX IF NOT EXISTS idx_import_jobs_status_created_at ON import_jobs(status, created_at ASC)' },
  { sql: 'CREATE INDEX IF NOT EXISTS idx_import_jobs_note_id ON import_jobs(note_id)' },
]

export async function ensureSchema(client: Client) {
  await client.batch(SCHEMA_STATEMENTS, 'write')

  for (const folder of DEFAULT_FOLDERS) {
    await client.execute({
      sql: `
        INSERT OR IGNORE INTO folders (id, name, icon, color, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [folder.id, folder.nombre, folder.icono, folder.color, folder.creadoEn],
    })
  }
}
