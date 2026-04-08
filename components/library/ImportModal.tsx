'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Link2, ArrowRight } from 'lucide-react'
import type { useStore } from '@/hooks/useStore'
import { useRouter } from 'next/navigation'

type Store = ReturnType<typeof useStore>

interface ImportModalProps {
  store: Store
  onClose: () => void
}

function isTikTokUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.hostname.includes('tiktok.com') || u.hostname.includes('vm.tiktok.com')
  } catch {
    return false
  }
}

export function ImportModal({ store, onClose }: ImportModalProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return

    if (!isTikTokUrl(trimmed)) {
      setError('Introduce un enlace válido de TikTok')
      return
    }

    setError('')
    setImporting(true)

    try {
      const notaId = await store.importarTikTok(trimmed)
      onClose()
      router.push(`/notas/${notaId}`)
    } catch {
      setError('Error al importar. Inténtalo de nuevo.')
      setImporting(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
      setError('')
    } catch {
      // silencioso
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full md:max-w-md md:mx-4 rounded-t-[24px] md:rounded-[20px] p-6 animate-fade-up"
        style={{
          background: 'var(--surface)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2
              className="text-base font-semibold"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
            >
              Importar TikTok
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Pega el enlace del vídeo
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full press transition-colors"
            style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Input */}
          <div
            className="flex items-center gap-2.5 px-4 py-3.5 rounded-[14px] transition-all"
            style={{
              background: 'rgba(0,0,0,0.04)',
              border: error ? '1.5px solid #ef4444' : '1.5px solid transparent',
            }}
          >
            <Link2 size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError('') }}
              placeholder="https://www.tiktok.com/@usuario/video/..."
              className="flex-1 bg-transparent text-sm outline-none min-w-0"
              style={{ color: 'var(--text-primary)' }}
              disabled={importing}
            />
            {!url && (
              <button
                type="button"
                onClick={handlePaste}
                className="text-xs font-medium shrink-0 px-2 py-1 rounded-md press transition-colors"
                style={{
                  background: 'rgba(0,0,0,0.07)',
                  color: 'var(--text-secondary)',
                }}
              >
                Pegar
              </button>
            )}
          </div>

          {error && (
            <p className="text-xs" style={{ color: '#ef4444', paddingLeft: '4px' }}>
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!url.trim() || importing}
            className="flex items-center justify-center gap-2 py-3.5 rounded-[14px] text-sm font-semibold press transition-all"
            style={{
              background: url.trim() && !importing ? 'var(--text-primary)' : 'rgba(0,0,0,0.08)',
              color: url.trim() && !importing ? 'white' : 'var(--text-tertiary)',
            }}
          >
            {importing ? (
              <>
                <span>Procesando</span>
                <div className="flex gap-1 ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" />
                  <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" />
                  <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" />
                </div>
              </>
            ) : (
              <>
                <span>Importar y analizar</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
