import { createImportJob, ensureTikTokUrl, getAppSnapshot } from '@/lib/server/clawtok-service'
import { handleRouteError, json, parseJsonBody } from '@/lib/server/http'
import { importCreateSchema } from '@/lib/server/validators'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request, importCreateSchema)
    const result = await createImportJob({
      url: ensureTikTokUrl(payload.url),
      source: payload.source,
      sourceAccount: payload.sourceAccount,
      requestedBy: payload.requestedBy,
    })
    const snapshot = await getAppSnapshot()
    return json({ result, snapshot }, 201)
  } catch (error) {
    return handleRouteError(error)
  }
}
