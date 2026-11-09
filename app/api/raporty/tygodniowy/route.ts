import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Raport tygodniowy: sprzedaż, budżet, wydarzenia, CRM
// Uruchamiany przez Vercel Cron w każdy poniedziałek o 7:00
// lub ręcznie z UI (?manual=1)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const RAPORT_SECRET = process.env.NOTIF_SECRET ?? 'horeca-notif-2026'

function fmt(n: number) { return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('pl-PL') }

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-notif-secret') || req.nextUrl.searchParams.get('secret')
  const isManual = req.nextUrl.searchParams.get('manual') === '1'
  if (!isManual && secret !== RAPORT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Zakres czasowy: ostatnie 7 dni
  const teraz = new Date()
  const tygodniaWstecz = new Date(teraz.getTime() - 7 * 86400000)
  const od = tygodniaWstecz.toISOString().slice(0, 10)
  const do_ = teraz.toISOString().slice(0, 10)
  const rok = teraz.getFullYear()

  // ─── Pobierz dane ───────────────────────────────────────────────────────────
  const [
    { data: sprzedaz },
    { data: wydarzeniaNowe },
    { data: wydarzeniaNajblizsze },
    { data: zadaniaCRM },
    { data: budzKat },
    { data: budzPlan },
    { data: budzReal },
    { data: emailCfg },
  ] = await Promise.all([
    supabase.from('sprzedaz').select('*, klienci(nazwa)').gte('data_sprzedazy', od).lte('data_sprzedazy', do_).order('data_sprzedazy', { ascending: false }),
    supabase.from('wydarzenia').select('id, nazwa, typ, status, budzet, data_od, liczba_gosci').gte('created_at', tygodniaWstecz.toISOString()).order('data_od'),
    supabase.from('wydarzenia').select('id, nazwa, typ, status, budzet, data_od, liczba_gosci').neq('status', 'anulowane').gte('data_od', do_).lte('data_od', new Date(teraz.getTime() + 14 * 86400000).toISOString().slice(0, 10)).order('data_od'),
    supabase.from('crm_zadania').select('*').eq('status', 'otwarte').lte('termin', do_).order('termin'),
    supabase.from('budzet_kategorie').select('*'),
    supabase.from('budzet_plan').select('*').eq('rok', rok),
    supabase.from('budzet_realizacja').select('*').eq('rok', rok),
    supabase.from('firma_dane').select('klucz, wartosc').in('klucz', ['notif_email', 'notif_raport_aktywny']),
  ])

  // Sprawdź email i czy raporty są włączone
  const cfg: Record<string, string> = {}
  emailCfg?.forEach((e: any) => { cfg[e.klucz] = e.wartosc })
  if (!isManual && cfg.notif_raport_aktywny !== 'true') {
    return NextResponse.json({ skipped: true, reason: 'Raporty tygodniowe wyłączone' })
  }
  const email = cfg.notif_email
  if (!email) return NextResponse.json({ error: 'Brak adresu email w ustawieniach' }, { status: 400 })

  // ─── Obliczenia ──────────────────────────────────────────────────────────────
  const sumaSprzBrutto = (sprzedaz ?? []).reduce((a: number, s: any) => a + Number(s.kwota_brutto ?? 0), 0)
  const sredniaFaktura = (sprzedaz ?? []).length > 0 ? sumaSprzBrutto / (sprzedaz ?? []).length : 0

  // Budżet YTD (year-to-date)
  const miesiac = teraz.getMonth() + 1
  const getSumPlan = (katId: string) =>
    (budzPlan ?? []).filter((p: any) => p.kategoria_id === katId && p.miesiac <= miesiac).reduce((a: number, p: any) => a + Number(p.kwota), 0)
  const getSumReal = (katId: string) =>
    (budzReal ?? []).filter((r: any) => r.kategoria_id === katId && r.miesiac <= miesiac).reduce((a: number, r: any) => a + Number(r.kwota), 0)
  const kategorie = budzKat ?? []
  const przychody = kategorie.filter((k: any) => k.typ === 'przychod')
  const koszty = kategorie.filter((k: any) => k.typ === 'koszt')
  const totalPlanPrz = przychody.reduce((a: number, k: any) => a + getSumPlan(k.id), 0)
  const totalRealPrz = przychody.reduce((a: number, k: any) => a + getSumReal(k.id), 0)
  const totalPlanKosz = koszty.reduce((a: number, k: any) => a + getSumPlan(k.id), 0)
  const totalRealKosz = koszty.reduce((a: number, k: any) => a + getSumReal(k.id), 0)
  const marza = totalRealPrz - totalRealKosz

  // Alerty budżetowe
  const alertyKosztow = koszty
    .map((k: any) => ({ ...k, pct: totalPlanKosz > 0 ? Math.round(getSumReal(k.id) / getSumPlan(k.id) * 100) : null }))
    .filter((k: any) => k.pct !== null && k.pct >= 80)
    .sort((a: any, b: any) => (b.pct ?? 0) - (a.pct ?? 0))
    .slice(0, 5)

  // ─── Generuj HTML emaila ─────────────────────────────────────────────────────
  const tydzienStr = `${fmtDate(od)} – ${fmtDate(do_)}`

  const html = `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:20px}
  .wrap{max-width:680px;margin:0 auto}
  .card{background:white;border-radius:12px;border:1px solid #e2e8f0;padding:20px;margin-bottom:16px}
  .hdr{background:linear-gradient(135deg,#1e40af,#1e293b);color:white;border-radius:12px;padding:20px;margin-bottom:16px}
  h1{margin:0;font-size:20px;font-weight:700}
  h2{font-size:14px;font-weight:600;color:#374151;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #f1f5f9}
  .kpi{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px}
  .kpi-box{background:#f8fafc;border-radius:8px;padding:12px}
  .kpi-val{font-size:18px;font-weight:700;color:#1e293b;margin:4px 0 2px}
  .kpi-lbl{font-size:11px;color:#64748b}
  .kpi-sub{font-size:11px;color:#94a3b8}
  .row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f8fafc;font-size:13px}
  .badge{display:inline-block;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:600}
  .red{background:#fee2e2;color:#b91c1c}
  .yellow{background:#fef9c3;color:#a16207}
  .green{background:#dcfce7;color:#15803d}
  .blue{background:#dbeafe;color:#1d4ed8}
  .footer{text-align:center;color:#94a3b8;font-size:11px;padding:12px 0}
  .btn{display:inline-block;background:#1e40af;color:white;padding:8px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;padding:6px 8px;background:#f8fafc;color:#64748b;font-weight:500;font-size:11px}
  td{padding:6px 8px;border-top:1px solid #f1f5f9}
</style></head>
<body><div class="wrap">

  <div class="hdr">
    <h1>📊 Raport tygodniowy HoReCa CRM</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:13px">${tydzienStr}</p>
  </div>

  <!-- SPRZEDAŻ -->
  <div class="card">
    <h2>💰 Sprzedaż (7 dni)</h2>
    <div class="kpi">
      <div class="kpi-box">
        <div class="kpi-lbl">Wartość sprzedaży brutto</div>
        <div class="kpi-val">${fmt(sumaSprzBrutto)} PLN</div>
        <div class="kpi-sub">${(sprzedaz ?? []).length} transakcji</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Średnia wartość dokumentu</div>
        <div class="kpi-val">${fmt(sredniaFaktura)} PLN</div>
        <div class="kpi-sub">brutto</div>
      </div>
    </div>
    ${(sprzedaz ?? []).length > 0 ? `
    <table>
      <tr><th>Klient</th><th>Dokument</th><th>Wartość</th><th>Data</th></tr>
      ${(sprzedaz ?? []).slice(0, 10).map((s: any) => `
        <tr>
          <td>${s.klienci?.nazwa ?? '—'}</td>
          <td>${s.nr_faktury ?? '—'}</td>
          <td>${fmt(Number(s.kwota_brutto ?? 0))} PLN</td>
          <td>${fmtDate(s.data_sprzedazy)}</td>
        </tr>`).join('')}
    </table>
    ${(sprzedaz ?? []).length > 10 ? `<p style="font-size:11px;color:#94a3b8;margin:6px 0 0">...i ${(sprzedaz ?? []).length - 10} więcej transakcji</p>` : ''}
    ` : '<p style="color:#94a3b8;font-size:13px">Brak transakcji w tym tygodniu</p>'}
  </div>

  <!-- BUDŻET YTD -->
  <div class="card">
    <h2>💰 Budżet ${rok} (narastająco do ${['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'][miesiac-1]})</h2>
    <div class="kpi">
      <div class="kpi-box">
        <div class="kpi-lbl">Przychody: plan vs realizacja</div>
        <div class="kpi-val" style="color:${totalRealPrz >= totalPlanPrz * 0.8 ? '#15803d' : '#b91c1c'}">${fmt(totalRealPrz)} PLN</div>
        <div class="kpi-sub">plan: ${fmt(totalPlanPrz)} PLN (${totalPlanPrz > 0 ? Math.round(totalRealPrz/totalPlanPrz*100) : 0}%)</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Koszty: plan vs realizacja</div>
        <div class="kpi-val" style="color:${totalRealKosz <= totalPlanKosz * 1.0 ? '#15803d' : '#b91c1c'}">${fmt(totalRealKosz)} PLN</div>
        <div class="kpi-sub">plan: ${fmt(totalPlanKosz)} PLN (${totalPlanKosz > 0 ? Math.round(totalRealKosz/totalPlanKosz*100) : 0}%)</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-lbl">Marża brutto YTD</div>
        <div class="kpi-val" style="color:${marza >= 0 ? '#15803d' : '#b91c1c'}">${fmt(marza)} PLN</div>
      </div>
    </div>
    ${alertyKosztow.length > 0 ? `
    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:10px;margin-top:10px">
      <p style="font-size:12px;font-weight:600;color:#a16207;margin:0 0 6px">⚠ Alerty budżetowe:</p>
      ${alertyKosztow.map((k: any) => `<div class="row"><span>${k.nazwa}</span><span class="badge ${k.pct >= 100 ? 'red' : 'yellow'}">${k.pct}% planu</span></div>`).join('')}
    </div>` : ''}
  </div>

  <!-- WYDARZENIA -->
  <div class="card">
    <h2>🎉 Wydarzenia i catering</h2>
    ${(wydarzeniaNowe ?? []).length > 0 ? `
    <p style="font-size:12px;color:#374151;margin:0 0 8px;font-weight:500">Nowe zapytania w tym tygodniu (${(wydarzeniaNowe ?? []).length}):</p>
    <table>
      <tr><th>Wydarzenie</th><th>Budżet</th><th>Termin</th></tr>
      ${(wydarzeniaNowe ?? []).slice(0, 5).map((w: any) => `
        <tr>
          <td>${w.nazwa}</td>
          <td>${w.budzet ? fmt(w.budzet) + ' PLN' : '—'}</td>
          <td>${w.data_od ? fmtDate(w.data_od) : '—'}</td>
        </tr>`).join('')}
    </table>` : '<p style="color:#94a3b8;font-size:13px">Brak nowych zapytań o wydarzenia</p>'}
    ${(wydarzeniaNajblizsze ?? []).length > 0 ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;margin-top:10px">
      <p style="font-size:12px;font-weight:600;color:#1d4ed8;margin:0 0 6px">📅 Najbliższe 14 dni:</p>
      ${(wydarzeniaNajblizsze ?? []).map((w: any) => {
        const dni = Math.ceil((new Date(w.data_od).getTime() - Date.now()) / 86400000)
        return `<div class="row"><span>${w.nazwa}${w.liczba_gosci ? ` (${w.liczba_gosci} os.)` : ''}</span><span class="badge blue">za ${Math.max(dni, 0)} dni</span></div>`
      }).join('')}
    </div>` : ''}
  </div>

  <!-- ZADANIA CRM -->
  ${(zadaniaCRM ?? []).length > 0 ? `
  <div class="card">
    <h2>✅ Przeterminowane zadania CRM (${(zadaniaCRM ?? []).length})</h2>
    <table>
      <tr><th>Tytuł</th><th>Termin</th><th>Priorytet</th></tr>
      ${(zadaniaCRM ?? []).slice(0, 5).map((z: any) => `
        <tr>
          <td>${z.tytul}</td>
          <td>${fmtDate(z.termin)}</td>
          <td><span class="badge ${z.priorytet === 'pilny' ? 'red' : z.priorytet === 'wysoki' ? 'yellow' : 'blue'}">${z.priorytet ?? 'normalny'}</span></td>
        </tr>`).join('')}
    </table>
  </div>` : ''}

  <div style="text-align:center;margin:16px 0">
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://horeca-crm.vercel.app'}/dashboard" class="btn">Otwórz HoReCa CRM →</a>
  </div>

  <div class="footer">
    <p>Raport automatyczny HoReCa CRM · ${new Date().toLocaleDateString('pl-PL')}</p>
    <p>Aby wyłączyć: Ustawienia → Powiadomienia → Raporty tygodniowe</p>
  </div>
</div></body></html>`

  // Wyślij email
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ sent: false, reason: 'Brak RESEND_API_KEY', preview: html.slice(0, 300) })
  }

  const resend = new Resend(resendKey)
  const { data: emailData, error: emailError } = await resend.emails.send({
    from: 'HoReCa CRM <onboarding@resend.dev>',
    to: [email],
    subject: `📊 Raport tygodniowy HoReCa CRM – ${tydzienStr}`,
    html,
  })

  if (emailError) return NextResponse.json({ sent: false, error: emailError.message }, { status: 500 })

  return NextResponse.json({ sent: true, email, id: emailData?.id, okres: tydzienStr })
}
