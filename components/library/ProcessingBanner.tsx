'use client'

import Link from 'next/link'
import { ImportacionReciente } from '@/lib/types'

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'En cola',
  procesando: 'Procesando vídeo',
  analizando: 'Analizando contenido',
  organizando: 'Organizando nota',
  completado: 'Completado',
  error: 'Error',
}

interface ProcessingBannerProps {
  importaciones: ImportacionReciente[]
}

export function ProcessingBanner({ importaciones }: ProcessingBannerProps) {
  if (importaciones.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {importaciones.map((importacion) => (
        <Link
          key={importacion.id}
          href={importacion.notaId ? `/notas/${importacion.notaId}` : '/'}
          className="block press"
        >
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
                {importacion.estimacion?.etapaLabel ??
                  ESTADO_LABELS[importacion.estado] ??
                  'Procesando'}
              </p>
              <p
                className="text-xs truncate mt-0.5"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {importacion.estimacion?.mensaje ?? importacion.url}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
