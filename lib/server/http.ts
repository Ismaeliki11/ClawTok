import { NextResponse } from 'next/server'
import type { ZodSchema } from 'zod'
import { AppError } from '@/lib/server/errors'

export async function parseJsonBody<T>(request: Request, schema: ZodSchema<T>) {
  const payload = await request.json()
  return schema.parse(payload)
}

export function json<T>(payload: T, status = 200) {
  return NextResponse.json(payload, { status })
}

export function handleRouteError(error: unknown) {
  if (error instanceof AppError) {
    return json({ error: error.message }, error.status)
  }

  if (error instanceof Error && error.name === 'ZodError') {
    return json({ error: error.message }, 400)
  }

  const message =
    error instanceof Error ? error.message : 'Unexpected server error'
  return json({ error: message }, 500)
}
