import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { dostawy, startAdres, koniecAdres } = await req.json()

    if (!dostawy || dostawy.length < 2) {
      return NextResponse.json({ error: 'Potrzebne co najmniej 2 dostawy do optymalizacji' }, { status: 400 })
    }

    const bazaStart = startAdres || 'nieznany punkt startowy'
    const bazaKoniec = koniecAdres || startAdres || 'nieznany punkt końcowy'

    // Zbuduj listę dostaw dla AI
    const listaDostawy = dostawy.map((d: any, i: number) => ({
      idx: i + 1,
      id: d.id,
      klient: d.klienci?.nazwa || '—',
      adres: d.adres_dostawy || '—',
      litry: d.ilosc_litry_plan || 0,
    }))

    const prompt = `Jesteś ekspertem od optymalizacji tras dostaw LPG w Polsce.
Masz do zaplanowania trasę dla cysterny z następującymi dostawami:

${listaDostawy.map((d: any) => `${d.idx}. ID: ${d.id} | Klient: ${d.klient} | Adres: ${d.adres} | Litry: ${d.litry}`).join('\n')}

Punkt startowy trasy: ${bazaStart}
Punkt końcowy trasy: ${bazaKoniec}

Zaproponuj OPTYMALNĄ kolejność dostaw minimalizując łączny dystans trasy.
Weź pod uwagę:
1. Geograficzne rozmieszczenie miejscowości w Polsce
2. Minimalizację kilometrów (łączna długość trasy)
3. Logiczny ciąg adresów (nie skaczemy między odległymi miastami)
4. Zoptymalizuj pętlę: ${bazaStart} → dostawy → ${bazaKoniec}

Odpowiedz TYLKO w formacie JSON (bez żadnego innego tekstu, bez markdown):
{"kolejnosc":["id1","id2","id3"],"uzasadnienie":"krótkie wyjaśnienie w 2-3 zdaniach"}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: 'Błąd AI: ' + err.slice(0, 300) }, { status: res.status })
    }

    const data = await res.json()
    const raw = (data.content?.[0]?.text ?? '').trim()

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Nie udało się sparsować odpowiedzi AI', raw }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      kolejnosc: result.kolejnosc || [],
      uzasadnienie: result.uzasadnienie || '',
    })
  } catch (err: any) {
    console.error('AI trasa optymalizuj error:', err)
    return NextResponse.json({ error: err.message || 'Błąd serwera' }, { status: 500 })
  }
}
