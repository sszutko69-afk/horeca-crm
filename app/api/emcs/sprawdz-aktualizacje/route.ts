import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

// Strony PUESC / MF do monitorowania wersji XSD
const ZRODLA_DO_SPRAWDZENIA = [
  'https://puesc.gov.pl/uslugi/e-commerce-1',
  'https://www.podatki.gov.pl/akcyza/akcyza-w-obrocie-wewnatrzunijnym-emcs-pl2/',
]

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

async function hashStr(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

export async function GET(req: NextRequest) {
  try {
    return await handler(req)
  } catch (e: any) {
    console.error('[emcs/sprawdz-aktualizacje] nieoczekiwany błąd:', e)
    return NextResponse.json({ error: 'Błąd serwera: ' + String(e?.message ?? e) }, { status: 500 })
  }
}

async function handler(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const manual = req.nextUrl.searchParams.get('manual') === '1'

  if (!manual && secret !== process.env.DEMO_RESET_SECRET && secret !== 'gazcrm-notif-2025') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // Pobierz aktualne ustawienia
  const { data: ustawienia } = await supabase
    .from('firma_dane')
    .select('klucz, wartosc')
    .in('klucz', ['emcs_ns_wersja', 'emcs_hash_puesc', 'emcs_ostatnie_sprawdzenie', 'email', 'emcs_monitoring_aktywny'])

  const cfg = Object.fromEntries((ustawienia || []).map(r => [r.klucz, r.wartosc]))

  if (!manual && cfg.emcs_monitoring_aktywny === 'false') {
    return NextResponse.json({ skipped: true, reason: 'Monitoring wyłączony' })
  }

  const aktualnaWersja = cfg.emcs_ns_wersja || '2025/03'
  const poprzedniHash = cfg.emcs_hash_puesc || ''

  // Pobierz strony PUESC równolegle (timeout 5s każda, łącznie max ~6s)
  let nowaZawartosc = ''
  const wynikiFetch: { url: string; status: string }[] = []

  const fetchUrl = async (url: string) => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'GazCRM-EMCS-Monitor/1.0' },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const text = await res.text()
        const relevant = text
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 5000)
        return { url, status: 'ok', content: relevant }
      } else {
        return { url, status: `HTTP ${res.status}`, content: '' }
      }
    } catch (e: any) {
      return { url, status: `błąd: ${e.message}`, content: '' }
    }
  }

  const wyniki = await Promise.all(ZRODLA_DO_SPRAWDZENIA.map(fetchUrl))
  for (const w of wyniki) {
    wynikiFetch.push({ url: w.url, status: w.status })
    nowaZawartosc += w.content
  }

  // Dodaj do hasha aktualną wersję (żeby alert był przy każdej zmianie wersji)
  nowaZawartosc += aktualnaWersja

  const nowyHash = nowaZawartosc ? await hashStr(nowaZawartosc) : 'brak-danych'
  const zmiana = nowyHash !== poprzedniHash && poprzedniHash !== ''
  const teraz = new Date().toISOString()

  // Zapisz hash i datę sprawdzenia
  for (const [klucz, wartosc] of [
    ['emcs_hash_puesc', nowyHash],
    ['emcs_ostatnie_sprawdzenie', teraz],
  ] as [string, string][]) {
    await supabase.from('firma_dane')
      .upsert({ klucz, wartosc }, { onConflict: 'klucz' })
  }

  // Wyślij email jeśli zmiana lub tryb manual
  const emailDocelowy = cfg.email || ''
  const resendKey = process.env.RESEND_API_KEY

  if ((zmiana || manual) && emailDocelowy && resendKey) {
    const resend = new Resend(resendKey)

    const tytul = zmiana
      ? `⚠️ GazCRM EMCS — Wykryto możliwą zmianę na PUESC`
      : `📋 GazCRM EMCS — Cotygodniowy raport monitoringu`

    const html = `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; }
  .alert { background: ${zmiana ? '#fef3cd' : '#e8f5e9'}; border-left: 4px solid ${zmiana ? '#f59e0b' : '#22c55e'}; padding: 16px; border-radius: 4px; margin-bottom: 20px; }
  .version { background: #1e3a5f; color: white; padding: 12px 20px; border-radius: 8px; display: inline-block; font-size: 20px; font-weight: bold; margin: 12px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
  th { background: #f3f4f6; font-weight: 600; }
  .btn { display: inline-block; background: #1e3a5f; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 4px; }
  .btn-green { background: #16a34a; }
  h2 { color: #1e3a5f; }
</style></head>
<body>
  <h2>🏭 GazCRM — Monitor EMCS PL 2</h2>

  <div class="alert">
    ${zmiana
      ? '<strong>⚠️ Wykryto zmiany</strong> na stronach PUESC/MF — treść strony zmieniła się od ostatniego sprawdzenia. Zalecane jest ręczne sprawdzenie czy wydano nową wersję schematów XSD.'
      : '<strong>✅ Brak zmian</strong> — strony PUESC wyglądają tak samo jak tydzień temu.'
    }
  </div>

  <p><strong>Aktualnie używana wersja XSD:</strong></p>
  <div class="version">📋 EDD ${aktualnaWersja}</div>
  <p style="font-size:12px;color:#6b7280;">Zmień w GazCRM → EMCS → Aktualizacje schematów</p>

  <h3>📊 Status sprawdzenia</h3>
  <table>
    <tr><th>Parametr</th><th>Wartość</th></tr>
    <tr><td>Data sprawdzenia</td><td>${new Date(teraz).toLocaleString('pl-PL')}</td></tr>
    <tr><td>Zmiana wykryta</td><td>${zmiana ? '⚠️ TAK' : '✅ NIE'}</td></tr>
    <tr><td>Hash strony PUESC</td><td style="font-family:monospace;font-size:11px">${nowyHash}</td></tr>
  </table>

  <h3>🔗 Sprawdź ręcznie (zawsze rekomendowane)</h3>
  <p>
    <a class="btn" href="https://puesc.gov.pl/uslugi/e-commerce-1">Portal PUESC</a>
    <a class="btn" href="https://www.podatki.gov.pl/akcyza/akcyza-w-obrocie-wewnatrzunijnym-emcs-pl2/">MF EMCS PL 2</a>
    <a class="btn btn-green" href="${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'vercel.app') || '#'}/emcs/aktualizacje">Aktualizuj wersję XSD</a>
  </p>

  <h3>📋 Co sprawdzić na PUESC:</h3>
  <ul>
    <li>Czy pojawiła się nowa wersja schematów XSD (np. <code>2025/09</code>)</li>
    <li>Czy zmienił się format komunikatów DD815B, DD818B</li>
    <li>Nowe kody CN lub kody transportu</li>
    <li>Zmiany w listach enumeracyjnych</li>
  </ul>

  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;">
  <p style="font-size:11px;color:#9ca3af;">
    GazCRM EMCS Monitor · Sprawdzenie automatyczne co poniedziałek 7:30 ·
    Wyłącz w Ustawienia EMCS
  </p>
</body>
</html>`

    await resend.emails.send({
      from: 'GazCRM <powiadomienia@ongaz.pl>',
      to: emailDocelowy,
      subject: tytul,
      html,
    })
  }

  return NextResponse.json({
    ok: true,
    zmiana,
    aktualnaWersja,
    nowyHash,
    poprzedniHash: poprzedniHash || '(brak)',
    wynikiFetch,
    emailWyslany: (zmiana || manual) && !!emailDocelowy && !!resendKey,
    sprawdzono: teraz,
  })
} // end handler

export async function POST(req: NextRequest) {
  return GET(req)
}
