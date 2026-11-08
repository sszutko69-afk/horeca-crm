import { NextRequest } from 'next/server'

export const maxDuration = 60

const PROMPT = `Jesteś ekspertem od kosztorysów budowlanych. Przeanalizuj ten dokument PDF i wyodrębnij z niego dane kosztorysu inwestorskiego.

Zwróć TYLKO poprawny JSON (bez markdown, bez \`\`\`json) w dokładnie takim formacie:
{
  "numer": "numer kosztorysu lub pusty string",
  "nazwa": "pełna nazwa kosztorysu",
  "inwestor": "nazwa inwestora lub null",
  "obiekt": "nazwa obiektu lub null",
  "lokalizacja": "lokalizacja lub null",
  "data_sporzadzenia": "YYYY-MM-DD lub dzisiejsza data",
  "kp_procent": liczba (np. 65),
  "kzm_procent": liczba (np. 10),
  "z_procent": liczba (np. 20),
  "vat_procent": liczba (np. 23),
  "uwagi": "uwagi lub null",
  "pozycje": [
    {
      "lp": numer porządkowy lub 0 dla działów,
      "typ": "pozycja" lub "dzial" lub "nota",
      "knr_kod": "kod KNR np. KNR-403 0101-01 lub pusty string",
      "opis": "opis roboty lub nazwa działu",
      "jm": "jednostka miary lub pusty string",
      "ilosc": liczba,
      "r_j": stawka robocizny na jednostkę,
      "m_j": stawka materiałów na jednostkę,
      "s_j": stawka sprzętu na jednostkę,
      "r_wartosc": wartość robocizny,
      "m_wartosc": wartość materiałów,
      "s_wartosc": wartość sprzętu,
      "bezposrednie": suma R+M+S,
      "kp_wartosc": 0,
      "kzm_wartosc": 0,
      "z_wartosc": 0,
      "razem": wartość pozycji razem
    }
  ]
}

Zasady:
- Działy/rozdziały mają typ "dzial", lp=0, ilosc=0, wszystkie liczby=0
- Pozycje kosztorysowe mają typ "pozycja" z kolejnym numerem lp
- kp_wartosc/kzm_wartosc/z_wartosc ustaw na 0 (zostaną przeliczone)
- Jeśli pole niedostępne: 0 dla liczb, "" lub null dla tekstów
- Daty w formacie YYYY-MM-DD
- Jeśli to nie kosztorys: {"error": "Dokument nie zawiera danych kosztorysu"}`

export async function POST(req: NextRequest) {
  try {
    const { base64 } = await req.json()
    if (!base64) return Response.json({ error: 'Brak danych PDF' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return Response.json({ error: 'Brak klucza ANTHROPIC_API_KEY' }, { status: 500 })

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        stream: true,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      return Response.json(
        { error: `Błąd API Claude (${claudeRes.status}): ${err.slice(0, 200)}` },
        { status: 502 }
      )
    }

    // Stream text chunks from Claude SSE → plain text response
    // This prevents Vercel from timing out on long Claude responses
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const body = new ReadableStream({
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
              } catch { /* ignore malformed SSE line */ }
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
