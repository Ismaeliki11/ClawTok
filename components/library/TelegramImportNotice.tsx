'use client'

import { ArrowUpRight, MessageCircle } from 'lucide-react'

const TELEGRAM_BOT_URL = 'https://t.me/clawtok_ismael_bot'
const TELEGRAM_BOT_HANDLE = '@clawtok_ismael_bot'

interface TelegramImportNoticeProps {
  compact?: boolean
  title?: string
  description?: string
}

export function TelegramImportNotice({
  compact = false,
  title = 'Importación solo por Telegram',
  description = 'Para procesar un TikTok, envía el enlace del vídeo al bot y él se encargará del análisis.',
}: TelegramImportNoticeProps) {
  return (
    <div
      className={compact ? 'rounded-[14px] p-4' : 'rounded-[18px] p-5'}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
          style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9' }}
        >
          <MessageCircle size={18} />
        </div>
        <div className="min-w-0">
          <p
            className={compact ? 'text-sm font-semibold' : 'text-[15px] font-semibold'}
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
          >
            {title}
          </p>
          <p
            className={compact ? 'text-xs mt-1.5' : 'text-sm mt-1.5'}
            style={{ color: 'var(--text-secondary)' }}
          >
            {description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium press"
              style={{ background: 'var(--text-primary)', color: 'white' }}
            >
              Abrir bot en Telegram
              <ArrowUpRight size={14} />
            </a>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {TELEGRAM_BOT_HANDLE}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
