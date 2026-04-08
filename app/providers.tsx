'use client'

import { StoreProvider } from '@/hooks/useStore'

export function Providers({ children }: { children: React.ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>
}
