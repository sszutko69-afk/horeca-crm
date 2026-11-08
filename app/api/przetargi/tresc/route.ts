import { NextRequest, NextResponse } from 'next/server'

const BZP_API = 'https://ezamowienia.gov.pl/mo-board/api/v1/notice'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const noticeNumber = searchParams.get('noticeNumber')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  if (!noticeNumber || !dateFrom || !dateTo) {
    return NextResponse.json({ error: 'Brak parametrów' }, { status: 400 })
  }

  try {
    // Pobierz ogłoszenie po numerze - API BZP zwraca htmlBody w odpowiedzi
    const params = new URLSearchParams({
      NoticeType: 'ContractNotice',
      NoticeNumber: noticeNumber,
      PageSize: '1',
      PublicationDateFrom: dateFrom,
      PublicationDateTo: dateTo,
    })

    const res = await fetch(`${BZP_API}?${params.toString()}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'GazCRM/1.0' },
      next: { revalidate: 3600 } // Cache 1h
    })

    if (!res.ok) {
      // Spróbuj szerszy zakres dat
      const params2 = new URLSearchParams({
        NoticeType: 'ContractNotice',
        NoticeNumber: noticeNumber,
        PageSize: '1',
        PublicationDateFrom: '2024-01-01T00:00:00',
        PublicationDateTo: new Date().toISOString().split('T')[0] + 'T23:59:59',
      })
      const res2 = await fetch(`${BZP_API}?${params2.toString()}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'GazCRM/1.0' }
      })
      if (!res2.ok) {
        return NextResponse.json({ error: `BZP HTTP ${res2.status}` }, { status: 502 })
      }
      const data2 = await res2.json()
      const p2 = Array.isArray(data2) ? data2[0] : null
      if (!p2) return NextResponse.json({ error: 'Nie znaleziono ogłoszenia' }, { status: 404 })
      return NextResponse.json({
        htmlBody: p2.htmlBody ?? null,
        tenderId: p2.tenderId ?? null,
        organizationName: p2.organizationName,
        submittingOffersDate: p2.submittingOffersDate,
        cpvCode: p2.cpvCode,
      })
    }

    const data = await res.json()
    const p = Array.isArray(data) ? data[0] : null

    if (!p) {
      return NextResponse.json({ error: 'Nie znaleziono ogłoszenia' }, { status: 404 })
    }

    return NextResponse.json({
      htmlBody: p.htmlBody ?? null,
      tenderId: p.tenderId ?? null,
      organizationName: p.organizationName,
      submittingOffersDate: p.submittingOffersDate,
      cpvCode: p.cpvCode,
      organizationCity: p.organizationCity,
      organizationProvince: p.organizationProvince,
    })

  } catch (err: any) {
    return NextResponse.json({ error: 'Błąd serwera: ' + err.message }, { status: 500 })
  }
}
