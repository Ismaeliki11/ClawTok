'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Search } from 'lucide-react'

export function BottomNav() {
  const pathname = usePathname()

  return (
    <div
      className="glass px-4 pt-2"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        borderTop: '1px solid var(--glass-border)',
      }}
    >
      <div className="flex justify-around">
        <BottomNavItem href="/" active={pathname === '/'} icon={<BookOpen size={22} />} label="Biblioteca" />
        <BottomNavItem href="/buscar" active={pathname === '/buscar'} icon={<Search size={22} />} label="Buscar" />
      </div>
    </div>
  )
}

function BottomNavItem({
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
      className="flex flex-col items-center gap-0.5 px-5 py-1.5 press transition-colors"
      style={{
        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
      }}
    >
      <div style={{ opacity: active ? 1 : 0.6 }}>{icon}</div>
      <span
        className="text-xs font-medium"
        style={{ fontSize: '10px', letterSpacing: '0.01em' }}
      >
        {label}
      </span>
    </Link>
  )
}
