import { assertAgentRequest } from '@/lib/server/auth'
import { getAgentSnapshot } from '@/lib/server/clawtok-service'
import { handleRouteError, json } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    assertAgentRequest(request)
    const snapshot = await getAgentSnapshot()
    return json({ snapshot })
  } catch (error) {
    return handleRouteError(error)
  }
}
