import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const INFAKT_API = 'https://app.infakt.pl/api/v3'

async function infaktGet(path: string, apiKey: string) {
  const res = await fetch(`${INFAKT_API}${path}`, {
    headers: { 'X-inFakt-ApiKey': apiKey, 'Accept': 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

async function fetchAllInvoices(apiKey: string): Promise<any[]> {
  const results: any[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const data = await infaktGet(`/invoices.json?per_page=${perPage}&page=${page}`, apiKey)
    if (!data) break
    const entities = data.entities ?? []
    results.push(...entities)
    const total = data.metainfo?.total_count ?? 0
    if (results.length >= total || entities.length < perPage) break
    page++
  }
  return results
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.INFAKT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Brak INFAKT_API_KEY w .env.local' }, { status: 500 })

  try {
    const allInvoices = await fetchAllInvoices(apiKey)

    const faktury = allInvoices.filter((i: any) => ['vat', 'advance', 'final', 'correction'].includes(i.kind))
    const proformy = allInvoices.filter((i: any) => i.kind === 'proforma')
    const paragony = allInvoices.filter((i: any) => i.kind === 'receipt')
    const inne = allInvoices.filter((i: any) => !['vat','advance','final','correction','proforma','receipt'].includes(i.kind))

    // Koszty — próbuj, jeśli 403 zwróć pustą listę z info
    let allCosts: any[] = []
    let costsError: string | null = null
    const costsRes = await fetch(`${INFAKT_API}/costs.json?per_page=100&page=1`, {
      headers: { 'X-inFakt-ApiKey': apiKey, 'Accept': 'application/json' },
      cache: 'no-store',
    })
    if (costsRes.ok) {
      const costsData = await costsRes.json()
      allCosts = costsData.entities ?? costsData.costs ?? []

      // Pobierz kolejne strony jeśli jest więcej
      const total = costsData.metainfo?.total_count ?? 0
      let page = 2
      while (allCosts.length < total) {
        const more = await infaktGet(`/costs.json?per_page=100&page=${page}`, apiKey)
        if (!more) break
        const entities = more.entities ?? more.costs ?? []
        allCosts.push(...entities)
        if (entities.length < 100) break
        page++
      }
    } else if (costsRes.status === 403) {
      costsError = 'Brak uprawnień api:costs:read — wygeneruj nowy klucz API z uprawnieniem "Odczyt kosztów"'
    }

    const sumaFaktury = faktury.reduce((a: number, f: any) => a + (f.gross_price ?? 0), 0)
    const sumaOplacone = faktury.filter((f: any) => f.status === 'paid').reduce((a: number, f: any) => a + (f.gross_price ?? 0), 0)
    const sumaDoOplaty = faktury.reduce((a: number, f: any) => a + (f.left_to_pay ?? 0), 0)
    const sumaKoszty = allCosts.reduce((a: number, e: any) => a + (e.gross_price ?? 0), 0)

    return NextResponse.json({
      invoices: faktury,
      proformy,
      paragony,
      inne,
      expenses: allCosts,
      costs_error: costsError,
      summary: {
        faktur: faktury.length,
        proform: proformy.length,
        paragonow: paragony.length,
        wydatkow: allCosts.length,
        wszystkich_dokumentow: allInvoices.length,
        przychod_brutto: sumaFaktury,
        oplacono: sumaOplacone,
        do_zaplaty: sumaDoOplaty,
        koszty_brutto: sumaKoszty,
        zysk_brutto: sumaFaktury - sumaKoszty,
      },
      synced_at: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
