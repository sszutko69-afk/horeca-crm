import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { przetargId, userId } = await req.json()
    if (!przetargId) return NextResponse.json({ error: 'Brak ID' }, { status: 400 })

    // Pobierz przetarg
    const { data: p, error: pErr } = await supabase
      .from('przetargi')
      .select('*')
      .eq('id', przetargId)
      .single()
    
    if (pErr || !p) return NextResponse.json({ error: 'Nie znaleziono przetargu' }, { status: 404 })

    // Stwórz inwestycję
    const { data: inv, error: invErr } = await supabase
      .from('inwestycje')
      .insert({
        nazwa: p.tytul,
        typ: 'przetarg',
        opis: [
          p.uwagi ?? '',
          p.zamawiajacy ? `\nZamawiający: ${p.zamawiajacy}` : '',
          p.url_ogloszenia ? `\nOgłoszenie: ${p.url_ogloszenia}` : '',
          p.url_postepowania ? `\nPostępowanie: ${p.url_postepowania}` : '',
          `\nŹródło przetargu: ${p.zrodlo ?? 'bzp'}`,
          `\nID przetargu: ${p.id}`,
        ].join('').trim(),
        status: 'w_realizacji',
        budzet: p.wartosc_netto ?? null,
        lokalizacja: p.miasto ?? null,
        data_rozpoczecia: new Date().toISOString().split('T')[0],
        data_planowanego_zakonczenia: p.data_skladania ?? null,
        dokumenty: p.dokumenty_url ?? [],
        notatki: `Przetarg wygrany. Przeniesiono z modułu Przetargi.\nBranża: ${p.branza ?? 'brak'}\nCPV: ${p.cpv_kod ?? 'brak'}`,
        created_by: userId ?? null,
      })
      .select('id')
      .single()

    if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

    // Zaktualizuj status przetargu
    await supabase.from('przetargi').update({
      status: 'wygrany',
      uwagi: (p.uwagi ?? '') + `\n\n✓ Przeniesiono do Inwestycji (ID: ${inv.id})`,
    }).eq('id', przetargId)

    return NextResponse.json({ ok: true, inwestycjaId: inv.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
