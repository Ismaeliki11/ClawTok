'use client'

import { useStore } from '@/hooks/useStore'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const store = useStore()

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Sidebar — visible desde md */}
      <div className="hidden md:flex flex-col shrink-0" style={{ width: 'var(--sidebar)' }}>
        <Sidebar store={store} />
      </div>

      {/* Contenido principal */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden min-w-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {children}
      </main>

      {/* Bottom nav — solo móvil */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNav />
      </div>
    </div>
  )
}
