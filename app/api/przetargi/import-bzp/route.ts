import { NextResponse } from 'next/server'
import { wymagajModulu } from '@/lib/dostep-api'
import { createAdminClient } from '@/lib/supabase-admin'

export const maxDuration = 60

// Import ogłoszeń z publicznego API BZP (e-Zamówienia) dla firmy zalogowanego użytkownika:
// pobiera ogłoszenia z ostatnich 30 dni, dopasowuje je do aktywnych branż firmy (kody CPV) i zapisuje w jej przetargach.
// Dane trafiają wyłącznie do firmy użytkownika (sesja użytkownika + RLS). BZP nie obsługuje paginacji, więc używamy okien datowych.
const BZP_API = 'https://ezamowienia.gov.pl/mo-board/api/v1/notice'
const NOTICE_TYPE = 'ContractNotice'
const PAGE_SIZE = 100
const DAYS_BACK = 30

export async function POST() {
  const dostep = await wymagajModulu('Przetargi')
  if ('blad' in dostep) return dostep.blad
  const { supabase, firma } = dostep

  // domyślne branże (budownictwo), jeśli firma nie ma jeszcze żadnych
  const { count } = await supabase.from('przetargi_branze').select('id', { count: 'exact', head: true })
  if (!count) await createAdminClient().rpc('seed_przetargi_branze', { p_firma: firma.id })

  const { data: branze } = await supabase.from('przetargi_branze').select('nazwa, cpv_kody').eq('aktywna', true)
  if (!branze?.length) return NextResponse.json({ error: 'Brak aktywnych branż. Dodaj branże w ustawieniach przetargów.' }, { status: 400 })

  const cpvToBranza: Record<string, string> = {}
  for (const b of branze) {
    for (const cpv of (b.cpv_kody ?? [])) {
      const prefix = String(cpv).replace(/[^0-9].*/, '').substring(0, 8)
      if (prefix) cpvToBranza[prefix] = b.nazwa
    }
  }

  const teraz = new Date()
  const iso = (d: Date) => d.toISOString().split('T')[0]
  const okna: { from: string; to: string }[] = []
  for (let d = DAYS_BACK; d > 7; d -= 5) {
    okna.push({ from: iso(new Date(teraz.getTime() - d * 86400000)), to: iso(new Date(teraz.getTime() - Math.max(8, d - 5) * 86400000)) })
  }
  for (let d = 7; d >= 0; d--) {
    const dt = iso(new Date(teraz.getTime() - d * 86400000))
    okna.push({ from: dt, to: dt })
  }

  let nowe = 0, duplikaty = 0, bledy = 0
  const log: string[] = []

  for (const okno of okna) {
    const params = new URLSearchParams({ NoticeType: NOTICE_TYPE, PageSize: String(PAGE_SIZE), PageNumber: '1', PublicationDateFrom: okno.from, PublicationDateTo: okno.to })
    let pozycje: any[] = []
    try {
      const res = await fetch(`${BZP_API}?${params}`, { headers: { Accept: 'application/json' } })
      if (!res.ok) { bledy++; log.push(`HTTP ${res.status} okno ${okno.from}`); continue }
      const data = await res.json()
      pozycje = Array.isArray(data) ? data : (data.notices ?? data.items ?? data.results ?? data.data ?? [])
    } catch (ex: any) { bledy++; log.push(`Błąd okna ${okno.from}: ${ex.message}`); continue }

    for (const p of pozycje) {
      const kody = String(p.cpvCode ?? '').split(',').map((s: string) => s.trim().replace(/[^0-9].*/, '').substring(0, 8)).filter(Boolean)
      const trafiony = kody.find(k => cpvToBranza[k])
      if (!trafiony) continue
      const bzpId = String(p.noticeNumber ?? p.bzpNumber ?? p.tenderId ?? '')
      if (!bzpId) { bledy++; continue }
      const skladanie = String(p.submittingOffersDate ?? p.submissionDeadlineDate ?? '').split('T')[0] || iso(new Date(Date.now() + 30 * 86400000))
      const wartosc = p.estimatedValue ?? p.totalEstimatedValue ?? null
      const { error } = await supabase.from('przetargi').upsert({
        bzp_id: bzpId,
        tytul: String(p.orderObject ?? p.title ?? p.orderSubject ?? 'Brak tytułu').trim(),
        zamawiajacy: p.organizationName ?? p.contractingAuthorityName ?? null,
        zamawiajacy_adres: [p.organizationCity, p.organizationProvince].filter(Boolean).join(', ') || null,
        wartosc_netto: wartosc ? parseFloat(String(wartosc)) : null,
        data_publikacji: String(p.publicationDate ?? '').split('T')[0] || null,
        data_skladania: skladanie,
        cpv_kod: trafiony,
        branza: cpvToBranza[trafiony],
        zrodlo: 'bzp',
        url_ogloszenia: p.publicationUrl ?? `https://ezamowienia.gov.pl/mp-client/search/list/${p.tenderId ?? bzpId}`,
        status: 'nowy',
        priorytet: 0,
      }, { onConflict: 'firma_id,bzp_id', ignoreDuplicates: true })
      if (error) { if (error.code === '23505') duplikaty++; else { bledy++; log.push(`Zapis ${bzpId}: ${error.message}`) } }
      else nowe++
    }
    await new Promise(r => setTimeout(r, 200))
  }

  return NextResponse.json({ ok: true, nowe, duplikaty, bledy, okna: okna.length, log })
}
