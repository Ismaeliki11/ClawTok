import { createClient, type Client } from '@libsql/client'
import { getEnv } from '@/lib/env'
import { ensureSchema } from '@/lib/db/schema'

let db: Client | null = null
let schemaReady: Promise<void> | null = null

function getClient() {
  if (!db) {
    const env = getEnv()
    db = createClient({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    })
  }

  return db
}

export async function getDb() {
  const client = getClient()

  if (!schemaReady) {
    schemaReady = ensureSchema(client).catch((error) => {
      schemaReady = null
      throw error
    })
  }

  await schemaReady
  return client
}
