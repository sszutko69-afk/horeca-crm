import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const NOTIF_SECRET = process.env.NOTIF_SECRET ?? 'gazcrm-notif-2025'

// POST /api/przetargi/notyfikacje — wysyła powiadomienie email o nowych przetargach
// Wywoływany przez Vercel Cron lub ręcznie z UI (przycisk "Testuj")
export async function POST(req: NextRequest) {
  // Weryfikacja (cron lub UI)
  const secret = req.headers.get('x-notif-secret') || req.nextUrl.searchParams.get('secret')
  const isManual = req.nextUrl.searchParams.get('manual') === '1'
  if (!isManual && secret !== NOTIF_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Pobierz ustawienia powiadomień z dane_firmy
  const { data: ustawienia } = await supabase
    .from('firma_dane')
    .select('klucz, wartosc')
    .in('klucz', ['notif_email', 'notif_min_wartosc', 'notif_aktywne', 'notif_godziny_wstecz'])

  const cfg: Record<string, string> = {}
  ustawienia?.forEach(u => { cfg[u.klucz] = u.wartosc })

  if (cfg.notif_aktywne !== 'true' && !isManual) {
    return NextResponse.json({ skipped: true, reason: 'Powiadomienia wyłączone' })
  }

  const email = cfg.notif_email
  if (!email) return NextResponse.json({ error: 'Brak adresu email w ustawieniach' }, { status: 400 })

  const minWartosc = parseFloat(cfg.notif_min_wartosc ?? '0') || 0
  const godzinyWstecz = parseInt(cfg.notif_godziny_wstecz ?? '24') || 24

  // Pobierz aktywne branże
  const { data: branze } = await supabase
    .from('przetargi_branze')
    .select('*')
    .eq('aktywna', true)

  const wszystkieCpv = (branze ?? []).flatMap((b: any) => b.cpv_kody ?? [])

  // Pobierz nowe przetargi z ostatnich X godzin
  const od = new Date(Date.now() - godzinyWstecz * 3600 * 1000).toISOString()
  let query = supabase
    .from('przetargi')
    .select('*')
    .gte('created_at', od)
    .eq('status', 'nowy')
    .order('data_skladania', { ascending: true })

  if (minWartosc > 0) query = query.gte('wartosc_netto', minWartosc)

  const { data: przetargi } = await query

  if (!przetargi || przetargi.length === 0) {
    return NextResponse.json({ sent: false, reason: 'Brak nowych przetargów', count: 0 })
  }

  // Filtruj wg CPV jeśli mamy branże
  const dopasowane = wszystkieCpv.length > 0
    ? przetargi.filter((p: any) => p.cpv_kod && wszystkieCpv.some((cpv: string) => p.cpv_kod.startsWith(cpv.slice(0, 5))))
    : przetargi

  if (dopasowane.length === 0) {
    return NextResponse.json({ sent: false, reason: 'Brak przetargów pasujących do branż', count: 0 })
  }

  // Grupuj wg branży
  function getBranza(p: any): string {
    if (!p.cpv_kod || !branze) return 'Inne'
    const b = (branze as any[]).find(br =>
      (br.cpv_kody ?? []).some((cpv: string) => p.cpv_kod.startsWith(cpv.slice(0, 5)))
    )
    return b?.nazwa ?? p.branza ?? 'Inne'
  }

  function fmt(n: number | null) {
    if (!n) return '—'
    return n.toLocaleString('pl-PL', { minimumFractionDigits: 0 }) + ' PLN'
  }
  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  function daysTill(d: string) {
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  }

  const html = `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 24px; }
  .card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 24px; max-width: 680px; margin: 0 auto; }
  .header { border-bottom: 2px solid #1e40af; padding-bottom: 16px; margin-bottom: 20px; }
  .title { font-size: 20px; font-weight: 700; color: #1e293b; margin: 0; }
  .subtitle { color: #64748b; font-size: 13px; margin: 4px 0 0; }
  .badge { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .przetarg { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
  .przetarg-title { font-weight: 600; color: #1e293b; font-size: 14px; margin: 0 0 6px; }
  .przetarg-meta { color: #64748b; font-size: 12px; margin: 2px 0; }
  .przetarg-val { font-weight: 700; color: #059669; font-size: 14px; }
  .termin-red { color: #dc2626; font-weight: 600; }
  .termin-ok { color: #059669; }
  .btn { display: inline-block; background: #1e40af; color: white; padding: 8px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; margin-top: 6px; }
  .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
</style></head>
<body>
<div class="card">
  <div class="header">
    <p class="title">🏆 ${dopasowane.length} nowych przetargów</p>
    <p class="subtitle">GazCRM · Powiadomienie automatyczne · ${new Date().toLocaleDateString('pl-PL')}</p>
  </div>

  ${dopasowane.map((p: any) => {
    const dni = daysTill(p.data_skladania)
    const terminCls = dni <= 3 ? 'termin-red' : 'termin-ok'
    return `
  <div class="przetarg">
    <p class="przetarg-title">${p.tytul}</p>
    <p class="przetarg-meta">📍 ${p.zamawiajacy ?? '—'} ${p.miasto ? '· ' + p.miasto : ''}</p>
    <p class="przetarg-meta">🏷 <span class="badge">${getBranza(p)}</span>${p.cpv_kod ? ' · CPV: ' + p.cpv_kod : ''}</p>
    <p class="przetarg-meta">💰 <span class="przetarg-val">${fmt(p.wartosc_netto)}</span></p>
    <p class="przetarg-meta">📅 Termin składania: <span class="${terminCls}">${fmtDate(p.data_skladania)} (${dni > 0 ? `za ${dni} dni` : dni === 0 ? 'DZIŚ' : 'po terminie'})</span></p>
    ${p.url_ogloszenia ? `<a href="${p.url_ogloszenia}" class="btn">Zobacz ogłoszenie →</a>` : ''}
  </div>`
  }).join('')}

  <div class="footer">
    <p>GazCRM · Wysłano automatycznie przez system powiadomień</p>
    <p>Aby wyłączyć powiadomienia, przejdź do <strong>Ustawienia → Powiadomienia</strong></p>
  </div>
</div>
</body></html>`

  // Wyślij email przez Resend
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({
      sent: false,
      reason: 'Brak klucza RESEND_API_KEY w zmiennych środowiskowych',
      przetargi_count: dopasowane.length,
      preview_html: html.slice(0, 500),
    })
  }

  const resend = new Resend(resendKey)
  const { data: emailData, error: emailError } = await resend.emails.send({
    from: 'GazCRM <powiadomienia@ongaz.pl>',
    to: [email],
    subject: `🏆 ${dopasowane.length} nowych przetargów – ${new Date().toLocaleDateString('pl-PL')}`,
    html,
  })

  if (emailError) {
    return NextResponse.json({ sent: false, error: emailError.message }, { status: 500 })
  }

  // Zapisz log ostatniego wysłania
  await supabase.from('firma_dane').upsert({
    klucz: 'notif_ostatnie_wyslanie',
    wartosc: new Date().toISOString(),
    kategoria: 'powiadomienia',
    opis: `Ostatnie wysłanie: ${dopasowane.length} przetargów`,
  }, { onConflict: 'klucz' })

  return NextResponse.json({
    sent: true,
    count: dopasowane.length,
    email,
    id: emailData?.id,
  })
}
