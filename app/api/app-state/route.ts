import { getAppSnapshot } from '@/lib/server/clawtok-service'
import { handleRouteError, json } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const snapshot = await getAppSnapshot()
    return json({ snapshot })
  } catch (error) {
    return handleRouteError(error)
  }
}
