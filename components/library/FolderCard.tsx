'use client'

import Link from 'next/link'
import { Carpeta } from '@/lib/types'

interface FolderCardProps {
  carpeta: Carpeta
  count: number
}

export function FolderCard({ carpeta, count }: FolderCardProps) {
  return (
    <Link href={`/carpetas/${carpeta.id}`} className="block press">
      <div
        className="rounded-[16px] p-4 flex flex-col gap-3 transition-shadow hover:shadow-md"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Icono */}
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-base font-medium"
          style={{
            background: `${carpeta.color}18`,
            color: carpeta.color,
          }}
        >
          {carpeta.icono}
        </div>

        {/* Info */}
        <div>
          <p
            className="text-sm font-semibold leading-tight"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
          >
            {carpeta.nombre}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {count === 0
              ? 'Sin notas'
              : count === 1
              ? '1 nota'
              : `${count} notas`}
          </p>
        </div>
      </div>
    </Link>
  )
}
