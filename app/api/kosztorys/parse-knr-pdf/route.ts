import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const PROMPT = `Jesteś ekspertem od katalogów KNR. Przeanalizuj dokument i wyodrębnij listę katalogów KNR — ich kody i nazwy.

Zwróć TYLKO JSON (bez markdown, bez \`\`\`):
{"katalogi":[{"kod":"KNR 0-10","nazwa":"Zewnętrzne sieci ciepłownicze z rur preizolowanych"}],"pozycje":[]}

Zasady:
- katalogi: WSZYSTKIE katalogi z listy (kody w formacie "KNR X-XX" lub "KNR AT-XX" itp.)
- pozycje: zostaw pustą tablicę []
- Jeśli to nie spis KNR: {"error":"Dokument nie zawiera katalogu KNR","katalogi":[],"pozycje":[]}`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return Response.json({ error: 'Brak klucza ANTHROPIC_API_KEY' }, { status: 500 })

    let messages: unknown[]

    if (body.base64) {
      // Natywna obsługa PDF przez Claude (bez pdfjs)
      messages = [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: body.base64,
            },
          },
          { type: 'text', text: PROMPT },
        ],
      }]
    } else if (body.text) {
      // Fallback: tekst wyekstrahowany wcześniej
      messages = [{
        role: 'user',
        content: `${PROMPT}\n\nTEKST Z PDF:\n${String(body.text).slice(0, 20000)}`,
      }]
    } else {
      return Response.json({ error: 'Brak danych (base64 lub text)' }, { status: 400 })
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        stream: true,
        messages,
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      return Response.json(
        { error: `Błąd API Claude (${claudeRes.status}): ${err.slice(0, 200)}` },
        { status: 502 }
      )
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const body2 = new ReadableStream({
      async start(controller) {
        const reader = claudeRes.body!.getReader()
        let lineBuffer = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            lineBuffer += decoder.decode(value, { stream: true })
            const lines = lineBuffer.split('\n')
            lineBuffer = lines.pop() || ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (!data || data === '[DONE]') continue
              try {
                const evt = JSON.parse(data)
                if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                  controller.enqueue(encoder.encode(evt.delta.text))
                }
              } catch { /* ignore */ }
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(body2, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  } catch (err: unknown) {
    const msg = (err as Error).message || 'Nieznany błąd'
    return Response.json({ error: msg }, { status: 500 })
  }
}
