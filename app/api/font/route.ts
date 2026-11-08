import { NextRequest, NextResponse } from 'next/server'

// Serwuje czcionki TTF z Google Fonts jako proxy same-origin
// aby uniknąć problemów CORS/CSP przy generowaniu PDF w przeglądarce

const FONT_URLS: Record<string, string> = {
  'roboto-regular': 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu72xKKTU1Kg.ttf',
  'roboto-bold':    'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc4AMP6lQ.ttf',
  'roboto-italic':  'https://fonts.gstatic.com/s/roboto/v30/KFOkCnqEu92Fr1Mu51xIIzIXKMny.ttf',
}

// Prosty cache in-memory (resetuje się przy cold start, ale działa przez wiele żądań)
const cache = new Map<string, ArrayBuffer>()

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') || ''
  const url = FONT_URLS[name]
  if (!url) return new NextResponse('Unknown font', { status: 404 })

  // Zwróć z cache jeśli dostępny
  if (cache.has(name)) {
    return new NextResponse(cache.get(name)!, {
      headers: {
        'Content-Type': 'font/ttf',
        'Cache-Control': 'public, max-age=604800',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return new NextResponse(`Upstream ${res.status}`, { status: 502 })
    const buf = await res.arrayBuffer()
    cache.set(name, buf)
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'font/ttf',
        'Cache-Control': 'public, max-age=604800',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (e: any) {
    console.error('[api/font]', name, e?.message)
    return new NextResponse('Font fetch error', { status: 502 })
  }
}
