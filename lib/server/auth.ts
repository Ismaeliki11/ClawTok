import { getEnv } from '@/lib/env'
import { unauthorized } from '@/lib/server/errors'

export function readAgentToken(request: Request) {
  const headerToken = request.headers.get('x-openclaw-agent-key')
  const authorization = request.headers.get('authorization')
  const bearerToken =
    authorization && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : null

  return headerToken ?? bearerToken
}

export function assertAgentRequest(request: Request) {
  const env = getEnv()
  const token = readAgentToken(request)
  if (!token || token !== env.OPENCLAW_AGENT_API_KEY) {
    throw unauthorized()
  }
}
