import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 120

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function calcPoz(
  ilosc: number, r_j: number, m_j: number, s_j: number,
  kp: number, kzm: number, z: number
) {
  const r_w = ilosc * r_j
  const m_w = ilosc * m_j
  const s_w = ilosc * s_j
  const bezp = r_w + m_w + s_w
  const kp_w = (r_w + s_w) * kp / 100
  const kzm_w = m_w * kzm / 100
  const z_w = (r_w + s_w + kp_w) * z / 100
  return {
    r_wartosc: r_w, m_wartosc: m_w, s_wartosc: s_w,
    bezposrednie: bezp, kp_wartosc: kp_w, kzm_wartosc: kzm_w, z_wartosc: z_w,
    razem: bezp + kp_w + kzm_w + z_w,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const opis: string = body.opis || ''
    // Obsługa zarówno nowego formatu (files[]) jak i starego (fileBase64/fileName)
    type FileEntry = { base64: string; name: string }
    const files: FileEntry[] = body.files && body.files.length > 0
      ? body.files
      : body.fileBase64
        ? [{ base64: body.fileBase64, name: body.fileName || 'plik' }]
        : []

    if (!opis && files.length === 0) {
      return NextResponse.json({ error: 'Brak opisu projektu lub pliku' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Pobierz kontekst KNR i cennik
    const [{ data: knrPoz }, { data: cenPoz }] = await Promise.all([
      supabase.from('knr_pozycje')
        .select('kod, nazwa, jm, r_norma, m_norma, s_norma, knr_katalogi(kod)')
        .limit(400),
      supabase.from('cenniki_pozycje')
        .select('nazwa, jm, typ, cena')
        .order('typ')
        .limit(300),
    ])

    // Kontekst KNR
    const knrContext = (knrPoz || []).map((p: any) => {
      const katKod = p.knr_katalogi?.kod || ''
      return `${katKod} ${p.kod}|${p.nazwa}|${p.jm}|R:${p.r_norma}|M:${p.m_norma}|S:${p.s_norma}`
    }).join('\n')

    // Kontekst cennika
    const cenRobocizna = (cenPoz || []).filter((p: any) => p.typ === 'R')
      .map((p: any) => `${p.nazwa}|${p.jm}|${p.cena}`).join('\n')
    const cenMaterialy = (cenPoz || []).filter((p: any) => p.typ === 'M')
      .map((p: any) => `${p.nazwa}|${p.jm}|${p.cena}`).join('\n')
    const cenSprzet = (cenPoz || []).filter((p: any) => p.typ === 'S')
      .map((p: any) => `${p.nazwa}|${p.jm}|${p.cena}`).join('\n')

    const systemPrompt = `Jesteś ekspertem kosztorysanta budowlanego specjalizującym sie w gazownictwie i instalacjach.
Twoje zadanie to przygotowanie szczegolowego kosztorysu inwestorskiego na podstawie opisu projektu.

DOSTEPNE POZYCJE KNR (format: katalog kod|nazwa|jm|R_norma|M_norma|S_norma):
${knrContext || '(brak pozycji KNR - uzyj wlasnej wiedzy)'}

CENNIK ROBOCIZNA [zl/r-g]:
${cenRobocizna || 'Monter gazociagow|r-g|45\nSlusarz|r-g|42\nRobotnik budowlany|r-g|38'}

CENNIK MATERIALY [zl/jm]:
${cenMaterialy || 'Rura PE100 DN110|m|38\nRura PE100 DN63|m|18\nZlaczka PE DN110|szt|85\nPiasek podsypkowy|m3|65'}

CENNIK SPRZET [zl/m-g]:
${cenSprzet || 'Koparka gabsienicowa|m-g|185\nSamochod|m-g|75\nAggregat spawalniczy|m-g|45'}

NARZUTY STANDARDOWE: Kp=68% (od R+S), Kzm=20% (od M), Z=10% (od R+S+Kp), VAT=23%

Zwroc WYLACZNIE poprawny JSON (bez markdown, bez komentarzy) w formacie:
{
  "nazwa": "krótka nazwa kosztorysu",
  "kp_procent": 68,
  "kzm_procent": 20,
  "z_procent": 10,
  "vat_procent": 23,
  "pozycje": [
    {"lp":1,"typ":"dzial","knr_kod":"","opis":"NAZWA DZIALU","jm":"","ilosc":0,"r_j":0,"m_j":0,"s_j":0,"r_wartosc":0,"m_wartosc":0,"s_wartosc":0,"bezposrednie":0,"kp_wartosc":0,"kzm_wartosc":0,"z_wartosc":0,"razem":0},
    {"lp":2,"typ":"pozycja","knr_kod":"KNR 2-01 0101-01","opis":"Opis roboty","jm":"m","ilosc":100,"r_j":0.5,"m_j":35.0,"s_j":0,"r_wartosc":50,"m_wartosc":3500,"s_wartosc":0,"bezposrednie":3550,"kp_wartosc":34,"kzm_wartosc":700,"z_wartosc":8.5,"razem":4292.5}
  ]
}

Zasady:
- Przygotuj MINIMUM 15 pozycji kosztorysowych z podzialem na dzialy (typ:dzial)
- Uzywaj kodow KNR z dostarczonej listy jesli pasuja do zakresu robot
- Ceny R/M/S pobieraj z cennika lub szacuj rynkowo dla budownictwa gazowego
- Oblicz wszystkie wartosci: r_wartosc=ilosc*r_j, m_wartosc=ilosc*m_j, s_wartosc=ilosc*s_j
- bezposrednie = r_wartosc+m_wartosc+s_wartosc
- kp_wartosc = (r_wartosc+s_wartosc)*kp_procent/100
- kzm_wartosc = m_wartosc*kzm_procent/100
- z_wartosc = (r_wartosc+s_wartosc+kp_wartosc)*z_procent/100
- razem = bezposrednie+kp_wartosc+kzm_wartosc+z_wartosc
- Zwroc TYLKO JSON`

    // Zbuduj wiadomosc
    const userContent: any[] = []

    if (opis) {
      userContent.push({ type: 'text', text: `Opis projektu inwestycji:\n${opis}` })
    }

    // Dodaj wszystkie załączone pliki
    for (const file of files) {
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      if (ext === 'pdf') {
        userContent.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: file.base64 },
        })
      } else if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
        const mt = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
          : ext === 'png' ? 'image/png'
          : ext === 'gif' ? 'image/gif'
          : 'image/webp'
        userContent.push({
          type: 'image',
          source: { type: 'base64', media_type: mt, data: file.base64 },
        })
      }
    }

    if (files.length > 1) {
      userContent.push({
        type: 'text',
        text: `Powyżej załączono ${files.length} dokumentów projektu (${files.map(f => f.name).join(', ')}). Przeanalizuj wszystkie i przygotuj szczegolowy kosztorys inwestorski. Zwroc TYLKO poprawny JSON.`,
      })
    } else {
      userContent.push({
        type: 'text',
        text: 'Przygotuj szczegolowy kosztorys inwestorski. Zwroc TYLKO poprawny JSON.',
      })
    }

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: AbortSignal.timeout(110000),
    })

    if (!apiRes.ok) {
      const errText = await apiRes.text()
      console.error('[ai-analiza] Anthropic error:', errText)
      return NextResponse.json({ error: `Błąd AI: ${apiRes.status}` }, { status: 502 })
    }

    const apiData = await apiRes.json()
    const responseText: string = apiData.content?.[0]?.text || ''

    // Parsuj JSON
    const clean = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI nie zwróciło poprawnego JSON', raw: responseText.slice(0, 500) }, { status: 422 })
    }

    let result: any
    try {
      result = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ error: 'Błąd parsowania JSON z odpowiedzi AI' }, { status: 422 })
    }

    // Przelicz wartości pozycji server-side
    const kp = result.kp_procent ?? 68
    const kzm = result.kzm_procent ?? 20
    const z = result.z_procent ?? 10

    result.pozycje = (result.pozycje || []).map((p: any, idx: number) => {
      const lp = p.lp || (idx + 1)
      if (p.typ !== 'pozycja') return { ...p, lp }
      const calc = calcPoz(p.ilosc || 0, p.r_j || 0, p.m_j || 0, p.s_j || 0, kp, kzm, z)
      return { ...p, lp, ...calc }
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[ai-analiza]', e)
    return NextResponse.json({ error: e.message || 'Błąd serwera' }, { status: 500 })
  }
}
