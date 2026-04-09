'use client'

import { useStore } from '@/hooks/useStore'
import { AppShell } from '@/components/layout/AppShell'
import { BrandMark } from '@/components/layout/BrandMark'
import { FolderCard } from '@/components/library/FolderCard'
import { NoteCard, NoteCardSkeleton } from '@/components/library/NoteCard'
import { ProcessingBanner } from '@/components/library/ProcessingBanner'
import { TelegramImportNotice } from '@/components/library/TelegramImportNotice'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  const store = useStore()

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
        <div
          className="sticky top-0 z-30 glass px-5 md:px-8 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
              <BrandMark mode="icon" priority />
              <h1
                className="text-xl font-bold"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
              >
                Biblioteca
              </h1>
            </div>
          </div>
        </div>

        <div className="px-5 md:px-8 py-6 max-w-3xl mx-auto flex flex-col gap-8">
          <TelegramImportNotice />

          {store.importacionesEnProceso.length > 0 && (
            <ProcessingBanner importaciones={store.importacionesEnProceso} />
          )}

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
                *
              </div>
              <h3
                className="text-base font-semibold mb-1.5"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
              >
                Tu biblioteca esta vacia
              </h3>
              <p className="text-sm max-w-xs mb-6" style={{ color: 'var(--text-secondary)' }}>
                Los TikToks nuevos ya no se importan desde la web. Envialos al bot de Telegram y
                apareceran aqui cuando termine el procesamiento.
              </p>
              <div className="w-full max-w-md">
                <TelegramImportNotice
                  compact
                  title="Enviar el video al bot"
                  description="ClawTok procesa nuevos enlaces solo desde Telegram."
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
