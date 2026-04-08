import { AppError } from '@/lib/server/errors'
import { handleRouteError } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    throw new AppError(
      'La importacion web esta desactivada. Envia el enlace al bot de Telegram para procesarlo.',
      403
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
