'use client'

import { useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { AppShell } from '@/components/layout/AppShell'
import { NoteCard } from '@/components/library/NoteCard'
import { Search, X } from 'lucide-react'

export default function BuscarPage() {
  const store = useStore()
  const [query, setQuery] = useState('')

  const resultados = query.trim().length >= 2 ? store.buscar(query) : []
  const todasLasNotas = store.notas
    .filter((n) => n.estadoProcesado === 'completado')
    .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime())

  return (
    <AppShell>
      <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}>
        {/* Header con buscador */}
        <div
          className="sticky top-0 z-30 glass px-5 md:px-8 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="max-w-2xl mx-auto">
            <h1
              className="text-xl font-bold mb-4"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              Buscar
            </h1>
            {/* Input de búsqueda */}
            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-[14px]"
              style={{
                background: 'rgba(0,0,0,0.05)',
                border: '1.5px solid transparent',
              }}
            >
              <Search size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca notas, términos, etiquetas..."
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="press"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 md:px-8 py-6 max-w-2xl mx-auto">
          {query.trim().length === 0 ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="text-base font-semibold"
                  style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
                >
                  Todas las notas
                </h2>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {todasLasNotas.length} {todasLasNotas.length === 1 ? 'nota' : 'notas'}
                </span>
              </div>
              {todasLasNotas.length === 0 ? (
                <div className="py-16 text-center">
                  <p style={{ color: 'var(--text-tertiary)' }} className="text-sm">
                    Aún no tienes notas guardadas
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {todasLasNotas.map((nota, i) => {
                    const carpeta = store.carpetas.find((c) => c.id === nota.carpetaId)
                    return (
                      <div
                        key={nota.id}
                        className="animate-fade-up"
                        style={{ animationDelay: `${i * 25}ms` }}
                      >
                        <NoteCard nota={nota} carpeta={carpeta} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : query.trim().length < 2 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
              Escribe al menos 2 caracteres para buscar
            </p>
          ) : resultados.length === 0 ? (
            <div className="py-16 text-center">
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center text-xl mx-auto mb-4"
                style={{ background: 'rgba(0,0,0,0.04)' }}
              >
                ◎
              </div>
              <p
                className="text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                Sin resultados para &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Prueba con otro término o importa un nuevo TikTok
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="text-base font-semibold"
                  style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
                >
                  Resultados
                </h2>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {resultados.length} {resultados.length === 1 ? 'nota' : 'notas'}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {resultados.map((nota, i) => {
                  const carpeta = store.carpetas.find((c) => c.id === nota.carpetaId)
                  return (
                    <div
                      key={nota.id}
                      className="animate-fade-up"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <NoteCard nota={nota} carpeta={carpeta} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
