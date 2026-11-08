import { NextRequest, NextResponse } from 'next/server'

// Proxy dla API Ministerstwa Finansów (biała lista VAT + dane firmy)
// Docs: https://www.podatki.gov.pl/wykaz-podatnikow-vat/api/
export async function GET(req: NextRequest) {
  const nip = req.nextUrl.searchParams.get('nip')
  if (!nip) return NextResponse.json({ error: 'Brak NIP' }, { status: 400 })

  // Oczyść NIP ze znaków specjalnych (kreski, spacje)
  const nipClean = nip.replace(/[^0-9]/g, '')
  if (nipClean.length !== 10) return NextResponse.json({ error: 'NIP musi mieć 10 cyfr' }, { status: 400 })

  const date = new Date().toISOString().slice(0, 10)
  const url = `https://wl-api.mf.gov.pl/api/search/nip/${nipClean}?date=${date}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GazCRM/1.0' },
      next: { revalidate: 3600 }, // cache 1h
    })

    if (!res.ok) {
      if (res.status === 404) return NextResponse.json({ error: 'Nie znaleziono firmy o podanym NIP' }, { status: 404 })
      return NextResponse.json({ error: `Błąd API MF: ${res.status}` }, { status: res.status })
    }

    const data = await res.json()
    const subject = data?.result?.subject

    if (!subject) return NextResponse.json({ error: 'Brak danych w odpowiedzi GUS' }, { status: 404 })

    // Parsuj adres: "ul. Przykładowa 1, 00-000 Miasto" lub "Krzywopłoty 41, 78-230 Szczecinek"
    const adresZrodlo = subject.workingAddress || subject.residenceAddress || ''
    const { ulica, kodPocztowy, miasto } = parsujAdres(adresZrodlo)

    return NextResponse.json({
      nazwa: subject.name ?? '',
      nip: subject.nip ?? nipClean,
      statusVat: subject.statusVat ?? '',
      adres: ulica,
      kod_pocztowy: kodPocztowy,
      miasto: miasto,
      adresRaw: adresZrodlo,
      pesel: subject.pesel ?? null,
      regon: subject.regon ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Błąd połączenia z API GUS: ' + err.message }, { status: 500 })
  }
}

// Parsuj adres z formatu "ul. Przykładowa 1, 00-000 Miasto Powiat"
function parsujAdres(raw: string): { ulica: string; kodPocztowy: string; miasto: string } {
  if (!raw) return { ulica: '', kodPocztowy: '', miasto: '' }

  // Szukaj kodu pocztowego XX-XXX
  const kodMatch = raw.match(/(\d{2}-\d{3})\s+(.+)/)
  if (!kodMatch) return { ulica: raw.trim(), kodPocztowy: '', miasto: '' }

  const kodPocztowy = kodMatch[1]
  const miasto = kodMatch[2].trim()

  // Wszystko przed kodem pocztowym to ulica (usuń końcowy przecinek i spacje)
  const kodIdx = raw.indexOf(kodPocztowy)
  const ulica = raw.slice(0, kodIdx).replace(/,\s*$/, '').trim()

  return { ulica, kodPocztowy, miasto }
}
