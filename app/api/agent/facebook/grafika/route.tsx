import { NextRequest } from 'next/server'
import { ImageResponse } from 'next/og'
import { timingSafeEqual } from 'crypto'
import { podpisGrafiki } from '@/lib/agent-facebook'

// Grafika do posta Skrojo (1080x1080, PNG). Adres podpisuje agent, więc nie da się
// generować dowolnych obrazów na naszej domenie. Parametry: t = hasło, b = etykieta branży, sig = podpis.

export async function GET(req: NextRequest) {
  const t = (req.nextUrl.searchParams.get('t') ?? '').slice(0, 110)
  const b = (req.nextUrl.searchParams.get('b') ?? '').slice(0, 40)
  const sig = req.nextUrl.searchParams.get('sig') ?? ''
  const oczekiwany = podpisGrafiki(t, b)
  if (!process.env.CRON_SECRET || sig.length !== oczekiwany.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(oczekiwany))) {
    return new Response('Forbidden', { status: 403 })
  }

  const rozmiar = t.length <= 40 ? 92 : t.length <= 70 ? 78 : 64

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(145deg, #032d60 0%, #0a4a9a 60%, #0176d3 100%)',
          padding: 56, color: 'white',
        }}
      >
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            border: '3px solid rgba(255,255,255,0.35)', borderRadius: 28, padding: 56,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', fontSize: 54, fontWeight: 700, letterSpacing: -1 }}>Skrojo</div>
            {b ? (
              <div style={{
                display: 'flex', fontSize: 28, padding: '10px 22px', borderRadius: 999,
                background: 'rgba(255,255,255,0.16)',
              }}>{b}</div>
            ) : null}
          </div>

          <div style={{ display: 'flex', fontSize: rozmiar, fontWeight: 700, lineHeight: 1.12, letterSpacing: -2 }}>
            {t}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', fontSize: 30, opacity: 0.85 }}>CRM szyty na miarę Twojej firmy</div>
            <div style={{
              display: 'flex', fontSize: 32, fontWeight: 700, padding: '16px 32px', borderRadius: 16,
              background: '#2e844a',
            }}>Wypróbuj: skrojo.pl</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  )
}
