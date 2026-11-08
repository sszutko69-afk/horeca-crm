import { NextRequest, NextResponse } from 'next/server'

// inFakt API v3 — https://api.infakt.pl/api/v3/
// Auth: nagłówek X-inFakt-ApiKey
// Kwoty w GROSZACH (100 = 1 zł)
// Dokumentacja: https://docs.infakt.pl/

const BASE = 'https://api.infakt.pl/api/v3'

function getKey(req: NextRequest): string {
  // 1. Z nagłówka requestu (gdy frontend podaje klucz użytkownika)
  const hdr = req.headers.get('X-inFakt-ApiKey')
  if (hdr && hdr.length > 10) return hdr
  // 2. Z env Vercel (klucz firmowy ustawiony w projekcie)
  return process.env.INFAKT_API_KEY ?? ''
}

async function infaktFetch(
  path: string,
  key: string,
  params?: Record<string, string>
): Promise<any> {
  const url = new URL(`${BASE}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v)
    })
  }
  const res = await fetch(url.toString(), {
    headers: {
      'X-inFakt-ApiKey': key,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`inFakt HTTP ${res.status}: ${body.substring(0, 300)}`)
  }
  return res.json()
}

export async function GET(req: NextRequest) {
  const key = getKey(req)
  if (!key) {
    return NextResponse.json({
      error: 'Brak klucza API inFakt. Ustaw zmienną INFAKT_API_KEY w Vercel → Settings → Environment Variables. Klucz generujesz w inFakt → Ustawienia konta → API.',
    }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const action   = searchParams.get('action') || 'faktury'
  const limit    = searchParams.get('limit')   || '50'
  const offset   = searchParams.get('offset')  || '0'
  const dateFrom = searchParams.get('date_from') || ''
  const dateTo   = searchParams.get('date_to')   || ''
  const q        = searchParams.get('q')          || ''
  const id       = searchParams.get('id')         || ''

  try {
    // ─── FAKTURY (przychody) ─────────────────────────────────────
    if (action === 'faktury' || action === 'invoices') {
      const params: Record<string, string> = { limit, offset }
      if (dateFrom) params['q[invoice_date_gteq]'] = dateFrom
      if (dateTo)   params['q[invoice_date_lteq]'] = dateTo
      if (q)        params['q[number_cont]']        = q
      const data = await infaktFetch('/invoices.json', key, params)
      const faktury = (data.entities ?? []).map((f: any) => ({
        id:              f.uuid ?? f.id,
        numer:           f.number ?? '',
        data_wystawienia: f.invoice_date ?? '',
        data_sprzedazy:  f.sell_date ?? f.invoice_date ?? '',
        termin_platnosci: f.payment_date ?? '',
        status:          f.status ?? '',
        klient_nazwa:    f.client_company_name || `${f.client_first_name || ''} ${f.client_last_name || ''}`.trim(),
        klient_nip:      f.client_tax_code ?? '',
        klient_email:    f.client_email ?? '',
        netto:           Number(((f.net_price   ?? 0) / 100).toFixed(2)),
        vat:             Number(((f.tax_price   ?? 0) / 100).toFixed(2)),
        brutto:          Number(((f.gross_price ?? 0) / 100).toFixed(2)),
        waluta:          f.currency ?? 'PLN',
        oplacona:        !!f.paid_date,
        data_oplaty:     f.paid_date ?? '',
        uwagi:           f.notes ?? '',
        link:            f.share_link ?? '',
        pdf:             f.print_link ?? '',
      }))
      return NextResponse.json({
        faktury,
        entities: faktury,   // alias dla kompatybilności
        total:   data.metainfo?.total_count ?? faktury.length,
        count:   data.metainfo?.count       ?? faktury.length,
      })
    }

    // ─── POJEDYNCZA FAKTURA ──────────────────────────────────────
    if (action === 'faktura') {
      if (!id) return NextResponse.json({ error: 'Podaj ?id=UUID faktury' }, { status: 400 })
      const data = await infaktFetch(`/invoices/${id}.json`, key)
      const f = data.invoice ?? data
      return NextResponse.json({
        id:              f.uuid ?? f.id,
        numer:           f.number,
        data_wystawienia: f.invoice_date,
        data_sprzedazy:  f.sell_date,
        klient_nazwa:    f.client_company_name || `${f.client_first_name || ''} ${f.client_last_name || ''}`.trim(),
        klient_nip:      f.client_tax_code,
        netto:           Number(((f.net_price   ?? 0) / 100).toFixed(2)),
        brutto:          Number(((f.gross_price ?? 0) / 100).toFixed(2)),
        uslugi: (f.services ?? []).map((s: any) => ({
          nazwa:         s.name,
          ilosc:         s.quantity,
          jm:            s.unit,
          cena_netto:    Number(((s.unit_net_price ?? 0) / 100).toFixed(2)),
          brutto:        Number(((s.gross_price   ?? 0) / 100).toFixed(2)),
          vat:           s.tax_symbol,
        })),
        link: f.share_link,
        pdf:  f.print_link,
      })
    }

    // ─── KLIENCI ─────────────────────────────────────────────────
    if (action === 'klienci' || action === 'clients') {
      const params: Record<string, string> = { limit, offset }
      if (q) params['q[company_name_cont]'] = q
      const data = await infaktFetch('/clients.json', key, params)
      const klienci = (data.entities ?? []).map((k: any) => ({
        id:     k.uuid ?? k.id,
        nazwa:  k.company_name || `${k.first_name || ''} ${k.last_name || ''}`.trim(),
        nip:    k.tax_code ?? '',
        email:  k.email ?? '',
        telefon: k.phone ?? '',
        ulica:  k.street ?? '',
        nr:     k.street_number ?? '',
        miasto: k.city ?? '',
        kod:    k.postal_code ?? '',
        kraj:   k.country ?? 'PL',
      }))
      return NextResponse.json({
        klienci,
        entities: klienci,
        total: data.metainfo?.total_count ?? klienci.length,
      })
    }

    // ─── PRODUKTY / USŁUGI ───────────────────────────────────────
    if (action === 'produkty' || action === 'products') {
      const params: Record<string, string> = { limit, offset }
      if (q) params['q[name_cont]'] = q
      const data = await infaktFetch('/products.json', key, params)
      const produkty = (data.entities ?? []).map((p: any) => ({
        id:         p.uuid ?? p.id,
        nazwa:      p.name,
        cena_netto: Number(((p.unit_net_price ?? 0) / 100).toFixed(2)),
        vat:        p.tax_symbol,
        jm:         p.unit ?? 'szt.',
        pkwiu:      p.pkwiu ?? '',
      }))
      return NextResponse.json({
        produkty,
        entities: produkty,
        total: data.metainfo?.total_count ?? produkty.length,
      })
    }

    // ─── KOSZTY ──────────────────────────────────────────────────────
    // Poprawny endpoint wg inFakt support: /api/v3/documents/costs.json
    if (action === 'koszty' || action === 'expenses') {
      const params: Record<string, string> = { limit, offset }
      if (dateFrom) params['q[issue_date_gteq]'] = dateFrom
      if (dateTo)   params['q[issue_date_lteq]'] = dateTo
      if (q)        params['q[client_company_name_cont]'] = q

      const data = await infaktFetch('/documents/costs.json', key, params)
      const koszty = (data.entities ?? []).map((k: any) => ({
        id:           k.uuid ?? k.id,
        // Pola specyficzne dla /documents/costs.json
        nazwa:        k.seller_name ?? k.name ?? k.title ?? k.description ?? '—',
        numer:        k.number ?? k.document_number ?? '',
        data:         k.issue_date ?? k.sale_date ?? k.date ?? '',
        termin:       k.due_date ?? '',
        data_otrzymania: k.received_date ?? '',
        kwota_netto:  Number(((k.net_price   ?? k.net_amount   ?? 0) / 100).toFixed(2)),
        kwota_vat:    Number(((k.tax_price   ?? k.tax_amount   ?? 0) / 100).toFixed(2)),
        kwota_brutto: Number(((k.gross_price ?? k.gross_amount ?? 0) / 100).toFixed(2)),
        kategoria:    k.category ?? k.category_name ?? k.kind ?? '',
        dostawca:     k.seller_name ?? k.client_company_name ?? k.supplier_company_name ?? '—',
        dostawca_nip: k.seller_tax_code ?? k.client_tax_code ?? k.supplier_tax_code ?? '',
        opis:         k.description ?? k.notes ?? '',
        status:       (k.statuses ?? []).map((s: any) => s.name).join(', '),
        zrodlo:       k.source ?? '',
        link:         k.share_link ?? '',
        waluta:       k.currency ?? 'PLN',
      }))
      return NextResponse.json({
        koszty,
        entities: koszty,
        total: data.metainfo?.total_count ?? koszty.length,
      })
    }

    // ─── WARIANTY FAKTUR (do budżetu) ─────────────────────────────
    if (action === 'przychody_miesiac') {
      const rok = searchParams.get('rok') || new Date().getFullYear().toString()
      const m   = searchParams.get('miesiac') || String(new Date().getMonth() + 1)
      const mm  = m.padStart(2, '0')
      const dateOd = `${rok}-${mm}-01`
      const dateDo = `${rok}-${mm}-31`
      const params = {
        limit: '200',
        'q[invoice_date_gteq]': dateOd,
        'q[invoice_date_lteq]': dateDo,
        'q[status_in][]':       'sent',
      }
      const data = await infaktFetch('/invoices.json', key, params)
      const suma_netto  = (data.entities ?? []).reduce((a: number, f: any) => a + (f.net_price   ?? 0), 0) / 100
      const suma_brutto = (data.entities ?? []).reduce((a: number, f: any) => a + (f.gross_price ?? 0), 0) / 100
      return NextResponse.json({
        rok: parseInt(rok),
        miesiac: parseInt(m),
        suma_netto:  Number(suma_netto.toFixed(2)),
        suma_brutto: Number(suma_brutto.toFixed(2)),
        liczba:      data.metainfo?.total_count ?? 0,
        faktury: (data.entities ?? []).map((f: any) => ({
          numer:  f.number,
          klient: f.client_company_name ?? '',
          brutto: Number(((f.gross_price ?? 0) / 100).toFixed(2)),
          data:   f.invoice_date,
        })),
      })
    }

    // ─── TEST POŁĄCZENIA ─────────────────────────────────────────
    if (action === 'test') {
      const data = await infaktFetch('/invoices.json', key, { limit: '1' })
      return NextResponse.json({
        ok:             true,
        komunikat:      'Połączenie z inFakt działa poprawnie ✓',
        total_faktur:   data.metainfo?.total_count ?? 0,
        api_base:       BASE,
        key_prefix:     key.substring(0, 6) + '***',
      })
    }

    // ─── DIAGNOZA — sprawdza wszystkie endpointy ─────────────────
    if (action === 'diagnoza') {
      const wyniki: Record<string, any> = {}
      const eps = [
        '/costs.json', '/expenses.json', '/cost_invoices.json',
        '/accounting_documents.json', '/purchase_invoices.json',
        '/documents.json', '/receipts.json',
      ]
      for (const ep of eps) {
        try {
          const r = await fetch(`${BASE}${ep}?limit=1`, {
            headers: { 'X-inFakt-ApiKey': key, 'Content-Type': 'application/json' },
            cache: 'no-store',
          })
          const body = await r.text()
          wyniki[ep] = { status: r.status, body: body.substring(0, 200) }
        } catch (e: any) {
          wyniki[ep] = { status: 'ERROR', body: e.message }
        }
      }
      return NextResponse.json({ wyniki, klucz_prefix: key.substring(0, 8) + '***' })
    }

    return NextResponse.json({
      error: `Nieznana akcja: "${action}"`,
      dostepne: ['faktury', 'faktura', 'klienci', 'produkty', 'koszty', 'przychody_miesiac', 'test', 'diagnoza'],
    }, { status: 400 })

  } catch (err: any) {
    console.error('[inFakt API error]', err.message)
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}

// ─── POST — utwórz fakturę VAT w inFakt ──────────────────────────────────────
// Body: { klient_nazwa, klient_nip?, klient_typ, data, ilosc_litry, cena_sprzedazy_brutto, forma_platnosci, nr_edd }
export async function POST(req: NextRequest) {
  const key = getKey(req)
  if (!key) return NextResponse.json({ error: 'Brak klucza API inFakt (INFAKT_API_KEY)' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 }) }

  const {
    klient_nazwa, klient_nip, klient_typ,
    data, ilosc_litry, cena_sprzedazy_brutto,
    forma_platnosci, nr_edd,
    termin_dni = 14,
  } = body

  if (!klient_nazwa || !data || !ilosc_litry || !cena_sprzedazy_brutto) {
    return NextResponse.json({ error: 'Brak wymaganych pól: klient_nazwa, data, ilosc_litry, cena_sprzedazy_brutto' }, { status: 400 })
  }

  // Przelicz cenę: cena_sprzedazy_brutto → cena netto per litr
  const cenaNetto = Number((cena_sprzedazy_brutto / 1.23).toFixed(6))
  const unitNetPriceGrosze = Math.round(cenaNetto * 100)   // grosze!
  const iloscLitry = Number(Number(ilosc_litry).toFixed(3))

  // Termin płatności
  const dataTerMin = new Date(data)
  dataTerMin.setDate(dataTerMin.getDate() + termin_dni)
  const paymentDate = dataTerMin.toISOString().slice(0, 10)

  // Mapowanie formy płatności
  const platMap: Record<string, string> = {
    przelew: 'transfer', gotowka: 'cash', karta: 'card',
  }
  const paymentMethod = platMap[forma_platnosci] ?? 'transfer'

  // Buduj payload inFakt
  const payload: any = {
    invoice: {
      invoice_date: data,
      sell_date: data,
      payment_method: paymentMethod,
      payment_date: paymentDate,
      notes: nr_edd ? `Dokument EDD: ${nr_edd}` : undefined,
      services: [
        {
          name: `Gaz propan-butan LPG${nr_edd ? ` (EDD ${nr_edd.slice(-10)})` : ''}`,
          count: iloscLitry,
          unit: 'l',
          unit_net_price: unitNetPriceGrosze,
          tax_symbol: '23',
          pkwiu: '19.20.29.0',  // PKWIU dla LPG
        },
      ],
    },
  }

  // Dane klienta — firma (NIP) vs osoba fizyczna
  if (klient_typ === 'firma' && klient_nip) {
    payload.invoice.client_company_name = klient_nazwa
    payload.invoice.client_tax_code = klient_nip.replace(/[^0-9]/g, '')
  } else {
    // Osoba fizyczna — rozdziel imię i nazwisko
    const parts = klient_nazwa.trim().split(/\s+/)
    payload.invoice.client_first_name = parts.slice(0, -1).join(' ') || klient_nazwa
    payload.invoice.client_last_name = parts.slice(-1)[0] || ''
  }

  try {
    const res = await fetch(`${BASE}/invoices.json`, {
      method: 'POST',
      headers: {
        'X-inFakt-ApiKey': key,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data_res = await res.json()
    if (!res.ok) {
      const msg = data_res?.errors ? JSON.stringify(data_res.errors) : data_res?.error ?? `HTTP ${res.status}`
      return NextResponse.json({ error: `inFakt: ${msg}` }, { status: res.status })
    }

    const f = data_res?.invoice ?? data_res
    return NextResponse.json({
      ok: true,
      id: f.uuid ?? f.id,
      numer: f.number ?? '',
      link: f.share_link ?? '',
      pdf: f.print_link ?? '',
      brutto: Number(((f.gross_price ?? 0) / 100).toFixed(2)),
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Błąd połączenia z inFakt: ' + err.message }, { status: 502 })
  }
}
