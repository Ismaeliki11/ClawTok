import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Clawtok',
    short_name: 'Clawtok',
    description: 'Convierte tus TikToks guardados en notas inteligentes, organizadas y faciles de consultar.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f7f5',
    theme_color: '#f8f7f5',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
