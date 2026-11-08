import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, messages, maxTokens } = await req.json()

    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens ?? 2000,
      system: systemPrompt ?? 'Jesteś pomocnym asystentem dla firmy ON Gaz.',
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
