'use client'

import Link from 'next/link'
import { Nota, Carpeta } from '@/lib/types'
import { formatRelativeDate } from '@/lib/utils'

interface NoteCardProps {
  nota: Nota
  carpeta?: Carpeta
  compact?: boolean
}

export function NoteCard({ nota, carpeta, compact = false }: NoteCardProps) {
  return (
    <Link
      href={`/notas/${nota.id}`}
      className="block press"
    >
      <div
        className="rounded-[14px] p-4 transition-shadow hover:shadow-md"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3
              className="text-sm font-semibold leading-snug mb-1 line-clamp-2"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
            >
              {nota.titulo}
            </h3>
            {!compact && nota.resumen && (
              <p
                className="text-xs leading-relaxed line-clamp-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                {nota.resumen}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {carpeta && (
            <span
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: `${carpeta.color}15`,
                color: carpeta.color,
              }}
            >
              <span style={{ fontSize: '10px' }}>{carpeta.icono}</span>
              {carpeta.nombre}
            </span>
          )}
          {nota.etiquetas.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(0,0,0,0.05)',
                color: 'var(--text-tertiary)',
              }}
            >
              {tag}
            </span>
          ))}
          <span
            className="ml-auto text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {formatRelativeDate(nota.creadoEn)}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function NoteCardSkeleton() {
  return (
    <div
      className="rounded-[14px] p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="skeleton h-4 w-3/4 mb-2" />
      <div className="skeleton h-3 w-full mb-1" />
      <div className="skeleton h-3 w-2/3" />
      <div className="flex gap-2 mt-3">
        <div className="skeleton h-5 w-16 rounded-full" />
        <div className="skeleton h-5 w-12 rounded-full" />
      </div>
    </div>
  )
}
