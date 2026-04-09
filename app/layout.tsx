import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/app/providers'

export const metadata: Metadata = {
  title: 'Clawtok - Tu biblioteca de TikToks',
  applicationName: 'Clawtok',
  description: 'Convierte tus TikToks guardados en notas inteligentes, organizadas y faciles de consultar.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Clawtok',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f8f7f5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
