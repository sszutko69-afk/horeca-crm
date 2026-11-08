// Supabase Edge Function: bzp-import
// API BZP — publiczne, bez OAuth
// BZP API nie obsługuje paginacji (PageNumber ignorowany) — używamy okien datowych

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const IMPORT_SECRET = Deno.env.get('BZP_IMPORT_SECRET') ?? 'gazcrm2025'

const BZP_API = 'https://ezamowienia.gov.pl/mo-board/api/v1/notice'
const NOTICE_TYPE = 'ContractNotice'   // dawniej ZP-400
const PAGE_SIZE = 100
const DAYS_BACK = 30     // całkowity zakres catch-up
// BZP zwraca zawsze pierwsze PAGE_SIZE wyników (paginacja nie działa).
// Ostatnie 7 dni: okna 1-dniowe (lepsze pokrycie ~30% vs 6% dla 5-dniowych)
// Starsze: okna 5-dniowe

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }
    })
  }

  const secret = req.headers.get('x-import-secret')
  if (secret !== IMPORT_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: branze, error: brErr } = await supabase
    .from('przetargi_branze')
    .select('nazwa, cpv_kody')
    .eq('aktywna', true)

  if (brErr || !branze?.length) {
    return new Response(JSON.stringify({ error: 'Brak aktywnych branż', details: brErr?.message }), { status: 400 })
  }

  // Mapa prefiks CPV (8 cyfr) → branża
  const cpvToBranza: Record<string, string> = {}
  for (const b of branze) {
    for (const cpv of (b.cpv_kody ?? [])) {
      const prefix = String(cpv).replace(/[^0-9].*/, '').substring(0, 8)
      if (prefix) cpvToBranza[prefix] = b.nazwa
    }
  }
  const cpvPrefixy = Object.keys(cpvToBranza)

  // Zbuduj okna datowe — ostatnie 7 dni po 1 dniu (lepsza trafność),
  // starsze (7-30 dni) po 5 dni
  const teraz = new Date()
  const okna: Array<{ from: string; to: string }> = []

  // Starsze: dni 30→8 w oknach 5-dniowych
  for (let d = DAYS_BACK; d > 7; d -= 5) {
    const start = new Date(teraz.getTime() - d * 86400000)
    const end   = new Date(teraz.getTime() - Math.max(8, d - 5) * 86400000)
    okna.push({ from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] })
  }

  // Ostatnie 7 dni: okna 1-dniowe
  for (let d = 7; d >= 0; d--) {
    const date = new Date(teraz.getTime() - d * 86400000).toISOString().split('T')[0]
    okna.push({ from: date, to: date })
  }

  let noweTotal = 0, duplikatyTotal = 0, bledyTotal = 0, okienTotal = 0
  const log: string[] = []
  log.push(`Branże: ${branze.length}, CPV prefiksów: ${cpvPrefixy.length}`)
  log.push(`Okna datowe: ${okna.length} (1-dniowe dla ostatnich 7 dni, 5-dniowe dla starszych)`)

  for (const okno of okna) {
    const params = new URLSearchParams({
      NoticeType: NOTICE_TYPE,
      PageSize: String(PAGE_SIZE),
      PageNumber: '1',
      PublicationDateFrom: okno.from,
      PublicationDateTo: okno.to,
    })

    const url = `${BZP_API}?${params.toString()}`
    let pozycje: any[] = []

    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'GazCRM/1.0 (ongaz.pl)' },
      })
      const text = await res.text()

      if (!res.ok) {
        log.push(`HTTP ${res.status} okno ${okno.from}: ${text.substring(0, 200)}`)
        bledyTotal++
        continue
      }

      let data: any
      try { data = JSON.parse(text) } catch {
        log.push(`JSON błąd okno ${okno.from}`)
        bledyTotal++
        continue
      }

      pozycje = Array.isArray(data) ? data : (data.notices ?? data.items ?? data.results ?? data.data ?? [])
      log.push(`Okno ${okno.from}→${okno.to}: ${pozycje.length} ogłoszeń`)
      okienTotal++

    } catch (ex: any) {
      log.push(`Wyjątek okno ${okno.from}: ${ex.message}`)
      bledyTotal++
      continue
    }

    for (const p of pozycje) {
      // cpvCode: "45000000-7 (Roboty...),45100000-8 (...)" — string z przecinkami
      const cpvString = String(p.cpvCode ?? '')
      const wszystkieCPV = cpvString
        .split(',')
        .map((s: string) => s.trim().replace(/[^0-9].*/, '').substring(0, 8))
        .filter(Boolean)

      let dopasowaneCPV: string | null = null
      let branza: string | null = null
      for (const cpv of wszystkieCPV) {
        if (cpvToBranza[cpv]) { dopasowaneCPV = cpv; branza = cpvToBranza[cpv]; break }
      }
      if (!dopasowaneCPV) continue

      const bzpId = String(p.noticeNumber ?? p.bzpNumber ?? p.tenderId ?? '')
      if (!bzpId) { bledyTotal++; continue }

      const tytul = (p.orderObject ?? p.title ?? p.orderSubject ?? 'Brak tytułu').trim()

      let dataSkladania: string = p.submittingOffersDate ?? p.submissionDeadlineDate ?? ''
      if (!dataSkladania) {
        dataSkladania = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
      } else {
        dataSkladania = String(dataSkladania).split('T')[0]
      }

      const dataPub = (p.publicationDate ?? '').split('T')[0] || null
      const zamawiajacy = p.organizationName ?? p.contractingAuthorityName ?? null
      const adres = [p.organizationCity, p.organizationProvince].filter(Boolean).join(', ') || null
      const wartosc = p.estimatedValue ?? p.totalEstimatedValue ?? null
      const urlOgl = p.publicationUrl
        ?? `https://ezamowienia.gov.pl/mp-client/search/list/${p.tenderId ?? bzpId}`

      const { error: upsertErr } = await supabase
        .from('przetargi')
        .upsert({
          bzp_id: bzpId,
          tytul,
          zamawiajacy,
          zamawiajacy_adres: adres,
          wartosc_netto: wartosc ? parseFloat(String(wartosc)) : null,
          data_publikacji: dataPub,
          data_skladania: dataSkladania,
          cpv_kod: dopasowaneCPV,
          branza,
          zrodlo: 'bzp',
          url_ogloszenia: urlOgl,
          status: 'nowy',
          priorytet: 0,
        }, { onConflict: 'bzp_id', ignoreDuplicates: true })

      if (upsertErr) {
        if (upsertErr.code === '23505') {
          duplikatyTotal++
        } else {
          bledyTotal++
          log.push(`Insert błąd (${bzpId}): ${upsertErr.message}`)
        }
      } else {
        noweTotal++
      }
    }

    await new Promise(r => setTimeout(r, 300))
  }

  const wynik = { ok: true, nowe: noweTotal, duplikaty: duplikatyTotal, bledy: bledyTotal, okna: okienTotal, log, timestamp: new Date().toISOString() }
  console.log('[bzp-import]', JSON.stringify({ nowe: noweTotal, duplikaty: duplikatyTotal, bledy: bledyTotal, okna: okienTotal }))
  return new Response(JSON.stringify(wynik), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
})
