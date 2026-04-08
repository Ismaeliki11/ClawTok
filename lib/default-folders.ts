import type { Carpeta } from '@/lib/types'

// "Otros" is the only pre-seeded folder — it acts as a temporary holder while a note
// is being processed and as a fallback if folder inference fails. All other folders
// are created automatically by the AI as content arrives.
export const DEFAULT_FOLDERS: Carpeta[] = [
  {
    id: 'otros',
    nombre: 'Otros',
    icono: '📂',
    color: '#6b7280',
    creadoEn: '2024-03-01T10:00:00.000Z',
  },
]
