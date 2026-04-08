import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

async function main() {
  const { getDb } = await import('../lib/db/client')
  await getDb()
  console.log('Turso schema is ready.')
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
