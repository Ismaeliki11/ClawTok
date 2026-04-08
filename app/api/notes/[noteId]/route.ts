import {
  deleteNoteById,
  getAppSnapshot,
  updateNoteFields,
} from '@/lib/server/clawtok-service'
import { notFound } from '@/lib/server/errors'
import { handleRouteError, json, parseJsonBody } from '@/lib/server/http'
import { noteUpdateSchema } from '@/lib/server/validators'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  context: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId } = await context.params
    const snapshot = await getAppSnapshot()
    const note = snapshot.notas.find((item) => item.id === noteId)

    if (!note) {
      throw notFound('Nota no encontrada')
    }

    return json({ note })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId } = await context.params
    const payload = await parseJsonBody(request, noteUpdateSchema)
    await updateNoteFields(noteId, payload)
    const snapshot = await getAppSnapshot()
    return json({ snapshot })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId } = await context.params
    await deleteNoteById(noteId)
    const snapshot = await getAppSnapshot()
    return json({ snapshot })
  } catch (error) {
    return handleRouteError(error)
  }
}
