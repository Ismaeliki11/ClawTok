'use client'

import Link from 'next/link'
import { Nota } from '@/lib/types'

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'En cola',
  procesando: 'Procesando vídeo',
  analizando: 'Analizando contenido',
  organizando: 'Organizando nota',
  completado: 'Completado',
  error: 'Error',
}

interface ProcessingBannerProps {
  notas: Nota[]
}

export function ProcessingBanner({ notas }: ProcessingBannerProps) {
  if (notas.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {notas.map((nota) => (
        <Link key={nota.id} href={`/notas/${nota.id}`} className="block press">
          <div
            className="rounded-[14px] px-4 py-3 flex items-center gap-3"
            style={{
              background: 'rgba(99, 102, 241, 0.06)',
              border: '1px solid rgba(99, 102, 241, 0.15)',
            }}
          >
            {/* Dots animados */}
            <div className="flex gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 pulse-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 pulse-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 pulse-dot" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: '#6366f1' }}>
                {ESTADO_LABELS[nota.estadoProcesado] ?? 'Procesando'}
              </p>
              <p
                className="text-xs truncate mt-0.5"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {nota.tiktokUrl}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
