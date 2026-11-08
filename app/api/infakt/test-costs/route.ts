import { NextRequest, NextResponse } from 'next/server'

const INFAKT_API = 'https://app.infakt.pl/api/v3'

export async function GET(request: NextRequest) {
  const apiKey = process.env.INFAKT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Brak klucza' }, { status: 500 })

  const endpoints = [
    '/costs.json?per_page=5&page=1',
    '/costs.json?limit=5',
    '/invoices.json?per_page=5&page=1',
  ]

  const results: Record<string, any> = {}

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${INFAKT_API}${ep}`, {
        headers: { 'X-inFakt-ApiKey': apiKey, 'Accept': 'application/json' },
        cache: 'no-store',
      })
      const text = await res.text()
      results[ep] = {
        status: res.status,
        ok: res.ok,
        body: text.slice(0, 500),
      }
    } catch (e: any) {
      results[ep] = { error: e.message }
    }
  }

  return NextResponse.json(results)
}
