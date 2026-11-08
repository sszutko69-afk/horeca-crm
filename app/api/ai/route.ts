import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, kontekst } = await request.json()

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: kontekst,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: 'AI błąd: ' + err.slice(0, 200) }, { status: res.status })
  }

  const data = await res.json()
  const tekst = data.content?.[0]?.text ?? 'Brak odpowiedzi.'
  return NextResponse.json({ odpowiedz: tekst })
}
