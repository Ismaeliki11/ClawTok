'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Search } from 'lucide-react'
import type { useStore } from '@/hooks/useStore'
import { TelegramImportNotice } from '@/components/library/TelegramImportNotice'

type Store = ReturnType<typeof useStore>

interface SidebarProps {
  store: Store
}

export function Sidebar({ store }: SidebarProps) {
  const pathname = usePathname()

  return (
    <nav
      className="h-full flex flex-col py-4 px-3 gap-1"
      style={{
        borderRight: '1px solid var(--border)',
        background: 'var(--background)',
      }}
    >
      <div className="px-3 mb-6 mt-2">
        <span
          className="text-base font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
        >
          Clawtok
        </span>
      </div>

      <NavItem href="/" active={pathname === '/'} icon={<BookOpen size={16} />} label="Biblioteca" />
      <NavItem href="/buscar" active={pathname === '/buscar'} icon={<Search size={16} />} label="Buscar" />

      <div className="mt-4 mb-1 px-3">
        <span
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--text-tertiary)', letterSpacing: '0.07em' }}
        >
          Carpetas
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        {store.carpetas.map((carpeta) => {
          const count = store.contarPorCarpeta(carpeta.id)
          const isActive = pathname === `/carpetas/${carpeta.id}`
          return (
            <Link
              key={carpeta.id}
              href={`/carpetas/${carpeta.id}`}
              className="flex items-center justify-between px-3 py-2 rounded-[10px] transition-colors group press"
              style={{
                background: isActive ? 'rgba(0,0,0,0.06)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="text-xs w-5 h-5 flex items-center justify-center rounded-md font-medium shrink-0"
                  style={{
                    background: `${carpeta.color}18`,
                    color: carpeta.color,
                  }}
                >
                  {carpeta.icono}
                </span>
                <span className="text-sm font-medium truncate">{carpeta.nombre}</span>
              </div>
              {count > 0 && (
                <span
                  className="text-xs tabular-nums shrink-0"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      <div className="flex-1" />

      <TelegramImportNotice
        compact
        title="Procesa videos desde Telegram"
        description="La web ya no importa TikToks. Envia el enlace al bot para crear notas nuevas."
      />
    </nav>
  )
}

function NavItem({
  href,
  active,
  icon,
  label,
}: {
  href: string
  active: boolean
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] transition-colors press"
      style={{
        background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}
