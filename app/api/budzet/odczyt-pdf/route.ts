import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { base64, filename } = await req.json()
    if (!base64) return NextResponse.json({ error: 'Brak danych PDF' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Brak klucza ANTHROPIC_API_KEY' }, { status: 500 })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            {
              type: 'text',
              text: `Przeanalizuj tę listę płac i wyodrębnij dane finansowe do budżetu firmy.
Zwróć TYLKO JSON bez markdown w formacie:
{
  "pozycje": [
    {"kategoria": "Wynagrodzenia brutto", "kwota": 12500.00, "opis": "suma wynagrodzeń brutto"},
    {"kategoria": "ZUS pracodawcy", "kwota": 2137.50, "opis": "składki ZUS pracodawcy"},
    {"kategoria": "Podatki i opłaty", "kwota": 890.00, "opis": "podatek dochodowy PIT"}
  ],
  "okres": "miesiac rok jesli widoczny",
  "suma_brutto": 12500.00
}
Dostepne kategorie: "Wynagrodzenia brutto", "ZUS pracodawcy", "Podatki i oplaty", "Uslugi zewnetrzne".
Wyciagnij WSZYSTKIE kwoty finansowe z listy plac.`,
            }
          ],
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: `Claude API error ${response.status}: ${err.substring(0, 200)}` }, { status: 502 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    
    // Wyczyść markdown jeśli jest
    const clean = text.replace(/^```json\s*/,'').replace(/\s*```$/,'').trim()
    
    try {
      const parsed = JSON.parse(clean)
      return NextResponse.json(parsed)
    } catch {
      // Spróbuj znaleźć JSON w tekście
      const jsonMatch = clean.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed2 = JSON.parse(jsonMatch[0])
          return NextResponse.json(parsed2)
        } catch {}
      }
      return NextResponse.json({ error: 'Nie udalo sie przetworzyc odpowiedzi AI', raw: text.substring(0, 500) }, { status: 422 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
