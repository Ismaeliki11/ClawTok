import { z } from 'zod'

const serverEnvSchema = z.object({
  OPENCLAW_AGENT_API_KEY: z.string().min(16),
  OPENCLAW_WORKER_AGENT_ID: z.string().min(1).default('clawtok'),
  OPENCLAW_WORKER_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(600),
  TURSO_AUTH_TOKEN: z.string().min(1),
  TURSO_DATABASE_URL: z.string().min(1),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cachedEnv: ServerEnv | null = null

export function getEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv
  }

  const parsedServerEnv = serverEnvSchema.safeParse({
    OPENCLAW_AGENT_API_KEY: process.env.OPENCLAW_AGENT_API_KEY,
    OPENCLAW_WORKER_AGENT_ID: process.env.OPENCLAW_WORKER_AGENT_ID ?? 'clawtok',
    OPENCLAW_WORKER_TIMEOUT_SECONDS:
      process.env.OPENCLAW_WORKER_TIMEOUT_SECONDS ?? '600',
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  })

  if (!parsedServerEnv.success) {
    throw new Error(`Invalid server environment: ${parsedServerEnv.error.message}`)
  }

  cachedEnv = parsedServerEnv.data
  return cachedEnv
}
