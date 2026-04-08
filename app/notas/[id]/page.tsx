'use client'

import { use, useState } from 'react'
import { useStore } from '@/hooks/useStore'
import { AppShell } from '@/components/layout/AppShell'
import { ArrowLeft, ExternalLink, Trash2, Edit3, Check, X, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ProcessingStatus } from '@/lib/types'
import { formatRelativeDate } from '@/lib/utils'

const ESTADO_LABELS: Record<ProcessingStatus, string> = {
  pendiente: 'En cola',
  procesando: 'Procesando vídeo',
  analizando: 'Analizando contenido',
  organizando: 'Organizando en carpeta',
  completado: 'Completado',
  error: 'Error al procesar',
}

export default function NotaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const store = useStore()
  const router = useRouter()
  const [editandoTitulo, setEditandoTitulo] = useState(false)
  const [tituloTemp, setTituloTemp] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!store.inicializado) {
    return (
      <AppShell>
        <NotaDetailSkeleton />
      </AppShell>
    )
  }

  const nota = store.notas.find((n) => n.id === id)

  if (!nota) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <p style={{ color: 'var(--text-secondary)' }}>Nota no encontrada</p>
          <Link href="/" className="text-sm press" style={{ color: 'var(--text-primary)' }}>
            Volver a Biblioteca
          </Link>
        </div>
      </AppShell>
    )
  }

  const carpeta = store.carpetas.find((c) => c.id === nota.carpetaId)
  const importacion = store.importaciones.find((item) => item.notaId === nota.id)
  const enProceso = nota.estadoProcesado !== 'completado' && nota.estadoProcesado !== 'error'

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await store.eliminarNota(nota.id)
    router.push('/')
  }

  const handleSaveTitulo = async () => {
    if (tituloTemp.trim()) {
      await store.editarNota(nota.id, { titulo: tituloTemp.trim() })
    }
    setEditandoTitulo(false)
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
            <button
              onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-full press shrink-0"
              style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}
            >
              <ArrowLeft size={16} />
            </button>

            <div className="flex-1 min-w-0">
              {carpeta && (
                <Link
                  href={`/carpetas/${carpeta.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium press"
                  style={{ color: carpeta.color }}
                >
                  <span>{carpeta.icono}</span>
                  {carpeta.nombre}
                  <ChevronRight size={11} />
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {nota.estadoProcesado === 'completado' && (
                <button
                  onClick={() => {
                    setTituloTemp(nota.titulo)
                    setEditandoTitulo(true)
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full press"
                  style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}
                >
                  <Edit3 size={15} />
                </button>
              )}
              <button
                onClick={handleDelete}
                className="w-8 h-8 flex items-center justify-center rounded-full press transition-colors"
                style={{
                  background: confirmDelete ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.05)',
                  color: confirmDelete ? '#ef4444' : 'var(--text-secondary)',
                }}
              >
                <Trash2 size={15} />
              </button>
              {confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs press"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 md:px-8 py-6 max-w-2xl mx-auto">
          {/* Estado de procesamiento */}
          {enProceso && (
            <div
              className="rounded-[14px] p-4 mb-6 flex items-center gap-3"
              style={{
                background: 'rgba(99,102,241,0.05)',
                border: '1px solid rgba(99,102,241,0.15)',
              }}
            >
              <div className="flex gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 pulse-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 pulse-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 pulse-dot" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: '#6366f1' }}>
                  {importacion?.estimacion?.etapaLabel ?? ESTADO_LABELS[nota.estadoProcesado]}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {importacion?.estimacion?.mensaje ??
                    'El tiempo depende de TikTok, la cola y si hace falta autenticar la sesion.'}
                </p>
              </div>
            </div>
          )}

          {nota.estadoProcesado === 'error' && (
            <div
              className="rounded-[14px] p-4 mb-6"
              style={{
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            >
              <p className="text-sm font-medium" style={{ color: '#ef4444' }}>
                Error al procesar el TikTok
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                No se pudo analizar este vídeo. Puedes eliminarlo e intentarlo de nuevo.
              </p>
            </div>
          )}

          {/* Título */}
          <div className="mb-6">
            {editandoTitulo ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={tituloTemp}
                  onChange={(e) => setTituloTemp(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitulo()
                    if (e.key === 'Escape') setEditandoTitulo(false)
                  }}
                  className="flex-1 text-xl font-bold bg-transparent outline-none border-b-2 pb-1"
                  style={{
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                    borderColor: 'var(--text-primary)',
                  }}
                />
                <button onClick={handleSaveTitulo} className="press text-green-600">
                  <Check size={18} />
                </button>
                <button onClick={() => setEditandoTitulo(false)} className="press" style={{ color: 'var(--text-tertiary)' }}>
                  <X size={18} />
                </button>
              </div>
            ) : (
              <h1
                className="text-xl font-bold leading-snug"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
              >
                {nota.titulo}
              </h1>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 mb-8 flex-wrap">
            <a
              href={nota.tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full press"
              style={{
                background: 'rgba(0,0,0,0.05)',
                color: 'var(--text-secondary)',
              }}
            >
              <ExternalLink size={12} />
              Ver en TikTok
            </a>
            {carpeta && (
              <Link
                href={`/carpetas/${carpeta.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full press"
                style={{
                  background: `${carpeta.color}15`,
                  color: carpeta.color,
                }}
              >
                {carpeta.icono} {carpeta.nombre}
              </Link>
            )}
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {formatRelativeDate(nota.creadoEn)}
            </span>
          </div>

          {nota.estadoProcesado === 'completado' && (
            <div className="flex flex-col gap-6 animate-fade-up">
              {/* Resumen */}
              {nota.resumen && (
                <NotaSection title="Resumen">
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {nota.resumen}
                  </p>
                </NotaSection>
              )}

              {/* Puntos clave */}
              {nota.puntosClave.length > 0 && (
                <NotaSection title="Puntos clave">
                  <ul className="flex flex-col gap-2">
                    {nota.puntosClave.map((punto, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span
                          className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: 'var(--text-primary)' }}
                        />
                        <span className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {punto}
                        </span>
                      </li>
                    ))}
                  </ul>
                </NotaSection>
              )}

              {/* Glosario */}
              {nota.glosario.length > 0 && (
                <NotaSection title="Glosario">
                  <div className="flex flex-col gap-3">
                    {nota.glosario.map((item, i) => (
                      <div key={i}>
                        <p
                          className="text-sm font-semibold mb-0.5"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {item.termino}
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {item.definicion}
                        </p>
                      </div>
                    ))}
                  </div>
                </NotaSection>
              )}

              {/* Por qué es útil */}
              {nota.utilidad && (
                <NotaSection title="Por qué es útil">
                  <div
                    className="rounded-[12px] p-4"
                    style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)' }}
                  >
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {nota.utilidad}
                    </p>
                  </div>
                </NotaSection>
              )}

              {/* Comentarios destilados */}
              {nota.comentariosDestilados.length > 0 && (
                <NotaSection title="De los comentarios">
                  <div className="flex flex-col gap-2">
                    {nota.comentariosDestilados.map((comentario, i) => (
                      <div
                        key={i}
                        className="rounded-[10px] px-4 py-3"
                        style={{
                          background: 'rgba(0,0,0,0.025)',
                          borderLeft: '2px solid var(--border-strong)',
                        }}
                      >
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {comentario}
                        </p>
                      </div>
                    ))}
                  </div>
                </NotaSection>
              )}

              {/* Etiquetas */}
              {nota.etiquetas.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {nota.etiquetas.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-tertiary)' }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Nota personal */}
              <NotaSection title="Mi nota">
                <PersonalNote
                  inicial={nota.notaPersonal ?? ''}
                  onSave={(text) => store.editarNota(nota.id, { notaPersonal: text })}
                />
              </NotaSection>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function NotaSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3
        className="text-xs font-semibold uppercase tracking-widest mb-3"
        style={{ color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}
      >
        {title}
      </h3>
      {children}
    </section>
  )
}

function PersonalNote({
  inicial,
  onSave,
}: {
  inicial: string
  onSave: (text: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [text, setText] = useState(inicial)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(text)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Escribe tu reflexión personal sobre este TikTok..."
          className="w-full text-sm p-3 rounded-[12px] outline-none resize-none"
          disabled={saving}
          style={{
            background: 'rgba(0,0,0,0.03)',
            border: '1.5px solid var(--border-strong)',
            color: 'var(--text-primary)',
          }}
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setEditing(false)}
            className="text-xs px-3 py-1.5 rounded-[8px] press"
            disabled={saving}
            style={{ color: 'var(--text-tertiary)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="text-xs px-3 py-1.5 rounded-[8px] font-medium press"
            disabled={saving}
            style={{ background: 'var(--text-primary)', color: 'white' }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="w-full text-left rounded-[12px] p-4 press"
      style={{
        background: 'rgba(0,0,0,0.03)',
        border: '1px dashed var(--border-strong)',
      }}
    >
      {text ? (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {text}
        </p>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Añade tu reflexión personal...
        </p>
      )}
    </button>
  )
}

function NotaDetailSkeleton() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="skeleton w-8 h-8 rounded-full" />
        <div className="skeleton h-4 w-24" />
      </div>
      <div className="skeleton h-7 w-4/5 mb-2" />
      <div className="skeleton h-5 w-2/5 mb-8" />
      <div className="flex flex-col gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton h-3 w-16 mb-3" />
            <div className="skeleton h-4 w-full mb-1" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
