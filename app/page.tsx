'use client'

import { useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { AppShell } from '@/components/layout/AppShell'
import { FolderCard } from '@/components/library/FolderCard'
import { NoteCard, NoteCardSkeleton } from '@/components/library/NoteCard'
import { ProcessingBanner } from '@/components/library/ProcessingBanner'
import { ImportModal } from '@/components/library/ImportModal'
import { Plus, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  const store = useStore()
  const [showImport, setShowImport] = useState(false)

  if (!store.inicializado) {
    return (
      <AppShell>
        <div className="p-6 max-w-3xl mx-auto">
          <div className="skeleton h-8 w-32 mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-[16px]" />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <NoteCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </AppShell>
    )
  }

  const carpetasConNotas = store.carpetas.filter((c) => store.contarPorCarpeta(c.id) > 0)
  const carpetasVacias = store.carpetas.filter((c) => store.contarPorCarpeta(c.id) === 0)
  const todasCarpetas = [...carpetasConNotas, ...carpetasVacias]

  return (
    <AppShell>
      <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}>
        {/* Header */}
        <div
          className="sticky top-0 z-30 glass px-5 md:px-8 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <h1
              className="text-xl font-bold"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              Biblioteca
            </h1>
            <button
              onClick={() => setShowImport(true)}
              className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium press"
              style={{ background: 'var(--text-primary)', color: 'white' }}
            >
              <Plus size={15} strokeWidth={2.5} />
              Importar
            </button>
          </div>
        </div>

        <div className="px-5 md:px-8 py-6 max-w-3xl mx-auto flex flex-col gap-8">
          {/* Import bar — desktop inline */}
          <div className="hidden md:block">
            <button
              onClick={() => setShowImport(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[14px] press text-left transition-shadow hover:shadow-md"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Plus size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Pega un enlace de TikTok para crear una nota...
              </span>
            </button>
          </div>

          {/* Procesando */}
          {store.notasEnProceso.length > 0 && (
            <ProcessingBanner notas={store.notasEnProceso} />
          )}

          {/* Carpetas */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2
                className="text-base font-semibold"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
              >
                Carpetas
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {todasCarpetas.map((carpeta, i) => (
                <div
                  key={carpeta.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${i * 25}ms` }}
                >
                  <FolderCard carpeta={carpeta} count={store.contarPorCarpeta(carpeta.id)} />
                </div>
              ))}
            </div>
          </section>

          {/* Notas recientes */}
          {store.notasRecientes.length > 0 ? (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="text-base font-semibold"
                  style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
                >
                  Recientes
                </h2>
                <Link
                  href="/buscar"
                  className="text-sm flex items-center gap-1 press"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Ver todo
                  <ArrowRight size={13} />
                </Link>
              </div>
              <div className="flex flex-col gap-2.5">
                {store.notasRecientes.map((nota, i) => {
                  const carpeta = store.carpetas.find((c) => c.id === nota.carpetaId)
                  return (
                    <div
                      key={nota.id}
                      className="animate-fade-up"
                      style={{ animationDelay: `${i * 35}ms` }}
                    >
                      <NoteCard nota={nota} carpeta={carpeta} />
                    </div>
                  )
                })}
              </div>
            </section>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div
                className="w-14 h-14 rounded-[18px] flex items-center justify-center text-2xl mb-5"
                style={{ background: 'rgba(0,0,0,0.04)' }}
              >
                ✦
              </div>
              <h3
                className="text-base font-semibold mb-1.5"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
              >
                Tu biblioteca está vacía
              </h3>
              <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
                Importa tu primer TikTok para convertirlo en una nota útil y organizada.
              </p>
              <button
                onClick={() => setShowImport(true)}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-sm font-semibold press"
                style={{ background: 'var(--text-primary)', color: 'white' }}
              >
                <Plus size={15} strokeWidth={2.5} />
                Importar primer TikTok
              </button>
            </div>
          )}
        </div>
      </div>

      {showImport && (
        <ImportModal store={store} onClose={() => setShowImport(false)} />
      )}
    </AppShell>
  )
}
