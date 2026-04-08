'use client'

import { use } from 'react'
import { useStore } from '@/hooks/useStore'
import { AppShell } from '@/components/layout/AppShell'
import { NoteCard, NoteCardSkeleton } from '@/components/library/NoteCard'
import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { ImportModal } from '@/components/library/ImportModal'

export default function CarpetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const store = useStore()
  const [showImport, setShowImport] = useState(false)

  if (!store.inicializado) {
    return (
      <AppShell>
        <div className="p-6 max-w-2xl mx-auto">
          <div className="skeleton h-8 w-40 mb-2" />
          <div className="skeleton h-4 w-24 mb-8" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <NoteCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </AppShell>
    )
  }

  const carpeta = store.carpetas.find((c) => c.id === id)
  const notas = store.notasPorCarpeta(id)

  if (!carpeta) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full">
          <p style={{ color: 'var(--text-secondary)' }}>Carpeta no encontrada</p>
          <Link href="/" className="mt-4 text-sm press" style={{ color: 'var(--text-primary)' }}>
            Volver a Biblioteca
          </Link>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}>
        {/* Header */}
        <div
          className="sticky top-0 z-30 glass px-5 md:px-8 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <Link
              href="/"
              className="w-8 h-8 flex items-center justify-center rounded-full press transition-colors shrink-0"
              style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div
                className="w-8 h-8 rounded-[9px] flex items-center justify-center text-sm font-medium shrink-0"
                style={{ background: `${carpeta.color}18`, color: carpeta.color }}
              >
                {carpeta.icono}
              </div>
              <div className="min-w-0">
                <h1
                  className="text-base font-bold leading-tight"
                  style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
                >
                  {carpeta.nombre}
                </h1>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {notas.length === 0 ? 'Sin notas' : notas.length === 1 ? '1 nota' : `${notas.length} notas`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium press shrink-0"
              style={{ background: 'var(--text-primary)', color: 'white' }}
            >
              <Plus size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">Importar</span>
            </button>
          </div>
        </div>

        <div className="px-5 md:px-8 py-6 max-w-2xl mx-auto">
          {notas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div
                className="w-14 h-14 rounded-[18px] flex items-center justify-center text-2xl mb-5"
                style={{ background: `${carpeta.color}10` }}
              >
                {carpeta.icono}
              </div>
              <h3
                className="text-base font-semibold mb-1.5"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
              >
                Sin notas en {carpeta.nombre}
              </h3>
              <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
                Importa un TikTok y se organizará aquí automáticamente.
              </p>
              <button
                onClick={() => setShowImport(true)}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-sm font-semibold press"
                style={{ background: 'var(--text-primary)', color: 'white' }}
              >
                <Plus size={15} strokeWidth={2.5} />
                Importar TikTok
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {notas.map((nota, i) => (
                <div
                  key={nota.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  <NoteCard nota={nota} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showImport && <ImportModal store={store} onClose={() => setShowImport(false)} />}
    </AppShell>
  )
}
