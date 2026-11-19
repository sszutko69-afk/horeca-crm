import { NextResponse } from 'next/server'
import { wymagajModulu } from '@/lib/dostep-api'
import { bezpiecznyFetch } from '@/lib/bezpieczny-fetch'

export const dynamic = 'force-dynamic'

// Ręczne sprawdzenie, czy strony PUESC/MF z schematami EMCS PL 2 zmieniły się od ostatniego sprawdzenia.
// Działa na danych firmy użytkownika (firma_dane przez sesję, RLS). Bez wysyłki e-mail i bez harmonogramu.
const ZRODLA = [
  'https://puesc.gov.pl/uslugi/e-commerce-1',
  'https://www.podatki.gov.pl/akcyza/akcyza-w-obrocie-wewnatrzunijnym-emcs-pl2/',
]

async function hashStr(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

export async function GET() {
  try {
    const d = await wymagajModulu('EMCS PL 2')
    if ('blad' in d) return d.blad
    const sb = d.supabase

    const { data: ust } = await sb.from('firma_dane').select('klucz, wartosc').in('klucz', ['emcs_ns_wersja', 'emcs_hash_puesc'])
    const cfg = Object.fromEntries((ust ?? []).map(r => [r.klucz, r.wartosc]))
    const aktualnaWersja = cfg.emcs_ns_wersja || '2025/03'
    const poprzedniHash = cfg.emcs_hash_puesc || ''

    const wynikiFetch: { url: string; status: string }[] = []
    let zawartosc = ''
    await Promise.all(ZRODLA.map(async url => {
      try {
        const res = await bezpiecznyFetch(url, { headers: { 'User-Agent': 'Skrojo-EMCS-Monitor/1.0' }, signal: AbortSignal.timeout(5000) })
        if (!res.ok) { wynikiFetch.push({ url, status: `HTTP ${res.status}` }); return }
        const text = (await res.text()).replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000)
        zawartosc += text
        wynikiFetch.push({ url, status: 'ok' })
      } catch (e: any) { wynikiFetch.push({ url, status: `błąd: ${e.message}` }) }
    }))

    const nowyHash = zawartosc ? await hashStr(zawartosc + aktualnaWersja) : 'brak-danych'
    const zmiana = nowyHash !== poprzedniHash && poprzedniHash !== '' && nowyHash !== 'brak-danych'
    const teraz = new Date().toISOString()
    if (nowyHash !== 'brak-danych') {
      await sb.from('firma_dane').upsert([
        { klucz: 'emcs_hash_puesc', wartosc: nowyHash },
        { klucz: 'emcs_ostatnie_sprawdzenie', wartosc: teraz },
      ], { onConflict: 'firma_id,klucz' })
    }

    return NextResponse.json({ ok: true, zmiana, aktualnaWersja, wynikiFetch, emailWyslany: false, sprawdzono: teraz })
  } catch (e: any) {
    return NextResponse.json({ error: 'Błąd serwera: ' + String(e?.message ?? e) }, { status: 500 })
  }
}
