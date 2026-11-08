import { NextRequest, NextResponse } from 'next/server'

const EDGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bzp-import`
const IMPORT_SECRET = process.env.BZP_IMPORT_SECRET ?? 'gazcrm2025'

export async function POST(request: NextRequest) {
  try {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-import-secret': IMPORT_SECRET,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    })

    const json = await res.json()

    // Zwróć pełną odpowiedź włącznie z log i errors
    return NextResponse.json(json)

  } catch (err: any) {
    return NextResponse.json({ error: 'Błąd serwera: ' + err.message }, { status: 500 })
  }
}
