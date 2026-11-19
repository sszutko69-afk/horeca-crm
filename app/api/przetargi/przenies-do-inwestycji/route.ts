import { NextRequest, NextResponse } from 'next/server'
import { wymagajModulu } from '@/lib/dostep-api'

// Wygrany przetarg → nowa inwestycja. Sesja użytkownika (RLS): przetarg i inwestycja dotyczą wyłącznie jego firmy.
export async function POST(req: NextRequest) {
  try {
    const dostep = await wymagajModulu('Przetargi')
    if ('blad' in dostep) return dostep.blad
    const { supabase, firma } = dostep
    if (!(await supabase.from('firmy').select('moduly').maybeSingle()).data?.moduly?.includes('Inwestycje') && !firma.demo) {
      return NextResponse.json({ error: 'Włącz moduł Inwestycje, aby przenieść do niego wygrany przetarg.' }, { status: 400 })
    }

    const { przetargId } = await req.json()
    if (!przetargId) return NextResponse.json({ error: 'Brak ID' }, { status: 400 })

    const { data: p } = await supabase.from('przetargi').select('*').eq('id', przetargId).maybeSingle()
    if (!p) return NextResponse.json({ error: 'Nie znaleziono przetargu' }, { status: 404 })

    const { data: inv, error: invErr } = await supabase.from('inwestycje').insert({
      nazwa: p.tytul,
      typ: 'inne',
      opis: [
        p.uwagi ?? '',
        p.zamawiajacy ? `\nZamawiający: ${p.zamawiajacy}` : '',
        p.url_ogloszenia ? `\nOgłoszenie: ${p.url_ogloszenia}` : '',
        p.url_postepowania ? `\nPostępowanie: ${p.url_postepowania}` : '',
        `\nŹródło przetargu: ${p.zrodlo ?? 'bzp'}`,
        `\nID przetargu: ${p.id}`,
      ].join('').trim(),
      status: 'w_trakcie',
      budzet: p.wartosc_netto ?? null,
      lokalizacja: p.miasto ?? null,
      data_rozpoczecia: new Date().toISOString().split('T')[0],
      data_planowanego_zakonczenia: p.data_skladania ?? null,
      dokumenty: p.dokumenty_url ?? [],
      notatki: `Przetarg wygrany. Przeniesiono z modułu Przetargi.\nBranża: ${p.branza ?? 'brak'}\nCPV: ${p.cpv_kod ?? 'brak'}`,
    }).select('id').single()
    if (invErr || !inv) return NextResponse.json({ error: invErr?.message ?? 'Nie udało się utworzyć inwestycji' }, { status: 500 })

    await supabase.from('przetargi').update({
      status: 'wygrany',
      uwagi: (p.uwagi ?? '') + `\n\n✓ Przeniesiono do Inwestycji (ID: ${inv.id})`,
    }).eq('id', przetargId)

    return NextResponse.json({ ok: true, inwestycjaId: inv.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
