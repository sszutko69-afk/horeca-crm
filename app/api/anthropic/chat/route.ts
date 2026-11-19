import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const sesja = await createServerSupabaseClient()
    const { data: { user } } = await sesja.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 })
    const { systemPrompt, messages, maxTokens } = await req.json()
    if (!Array.isArray(messages) || JSON.stringify(messages).length > 400_000) return NextResponse.json({ error: 'Nieprawidłowe lub zbyt duże zapytanie.' }, { status: 400 })

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: Math.min(Math.max(Number(maxTokens) || 2000, 1), 4000),
      system: systemPrompt ?? 'Jesteś pomocnym asystentem w systemie CRM Skrojo.',
      messages: messages ?? [],
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25', // obsługa PDF document blocks
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message ?? 'Błąd API' }, { status: res.status })
    }

    const content = data.content?.find((b: any) => b.type === 'text')?.text ?? ''
    return NextResponse.json({ content })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
