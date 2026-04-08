import { assertAgentRequest } from '@/lib/server/auth'
import {
  createImportJob,
  deleteNoteById,
  ensureTikTokUrl,
  getAgentSnapshot,
  getImportJobSummary,
  retryImportJob,
  searchNotes,
} from '@/lib/server/clawtok-service'
import { notFound } from '@/lib/server/errors'
import { handleRouteError, json, parseJsonBody } from '@/lib/server/http'
import { agentActionSchema } from '@/lib/server/validators'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    assertAgentRequest(request)
    const payload = await parseJsonBody(request, agentActionSchema)

    let result: Record<string, unknown> | undefined

    switch (payload.action) {
      case 'import.create':
        result = await createImportJob({
          url: ensureTikTokUrl(payload.input.url),
          source: payload.input.source,
          sourceAccount: payload.input.sourceAccount,
          requestedBy: payload.input.requestedBy,
        })
        break
      case 'job.retry':
        await retryImportJob(payload.input.jobId)
        result = { jobId: payload.input.jobId }
        break
      case 'job.status': {
        const job = await getImportJobSummary(payload.input.jobId)
        if (!job) {
          throw notFound('Importacion no encontrada')
        }
        result = { job }
        break
      }
      case 'note.delete':
        await deleteNoteById(payload.input.noteId)
        result = { noteId: payload.input.noteId }
        break
      case 'note.search':
        result = {
          notes: await searchNotes(payload.input.query, payload.input.limit ?? 5),
        }
        break
      default:
        break
    }

    const snapshot = await getAgentSnapshot()
    return json({ result, snapshot })
  } catch (error) {
    return handleRouteError(error)
  }
}
