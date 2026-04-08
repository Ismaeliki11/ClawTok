import type { AppSnapshot, Nota } from '@/lib/types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Request failed')
  }

  return payload as T
}

export function fetchAppState() {
  return request<{ snapshot: AppSnapshot }>('/api/app-state')
}

export function createImport(url: string) {
  return request<{ result: { jobId: string; noteId: string }; snapshot: AppSnapshot }>(
    '/api/imports',
    {
      method: 'POST',
      body: JSON.stringify({ url, source: 'web' }),
    }
  )
}

export function updateNote(noteId: string, updates: Partial<Pick<Nota, 'notaPersonal' | 'titulo'>>) {
  return request<{ snapshot: AppSnapshot }>(`/api/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      notaPersonal: updates.notaPersonal,
      title: updates.titulo,
    }),
  })
}

export function deleteNote(noteId: string) {
  return request<{ snapshot: AppSnapshot }>(`/api/notes/${noteId}`, {
    method: 'DELETE',
  })
}
