import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Skrojo',
    short_name: 'Skrojo',
    description: 'CRM szyty na miarę Twojej firmy',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#2563eb',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
