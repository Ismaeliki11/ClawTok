import { z } from 'zod'

function isTikTokUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      url.hostname.includes('tiktok.com') ||
      url.hostname.includes('vm.tiktok.com')
    )
  } catch {
    return false
  }
}

export const tiktokUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => isTikTokUrl(value), 'Introduce un enlace valido de TikTok')

export const importCreateSchema = z.object({
  url: tiktokUrlSchema,
  requestedBy: z.string().trim().max(120).optional(),
  source: z.enum(['agent', 'telegram', 'web']).default('web'),
  sourceAccount: z.string().trim().max(120).optional(),
})

export const noteUpdateSchema = z
  .object({
    notaPersonal: z.string().max(5000).optional(),
    title: z.string().trim().min(1).max(160).optional(),
  })
  .refine(
    (value) => value.title !== undefined || value.notaPersonal !== undefined,
    'At least one field must be updated'
  )

export const agentActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('import.create'),
    input: z.object({
      requestedBy: z.string().trim().max(120).optional(),
      sourceAccount: z.string().trim().max(120).optional(),
      source: z.enum(['agent', 'telegram']).default('telegram'),
      url: tiktokUrlSchema,
    }),
  }),
  z.object({
    action: z.literal('job.retry'),
    input: z.object({ jobId: z.string().trim().min(1) }),
  }),
  z.object({
    action: z.literal('job.status'),
    input: z.object({ jobId: z.string().trim().min(1) }),
  }),
  z.object({
    action: z.literal('note.delete'),
    input: z.object({ noteId: z.string().trim().min(1) }),
  }),
  z.object({
    action: z.literal('note.search'),
    input: z.object({
      limit: z.coerce.number().int().min(1).max(10).optional(),
      query: z.string().trim().min(2).max(120),
    }),
  }),
])
