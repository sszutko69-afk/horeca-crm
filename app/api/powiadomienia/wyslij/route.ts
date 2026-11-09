// ═══════════════════════════════════════════════════════════════════════════
// WYSYŁKA POWIADOMIEŃ MAILEM
//
// Zbiera nieprzeczytane powiadomienia starsze niż kilka minut i wysyła je
// jedną wiadomością na odbiorcę. Opóźnienie jest celowe: jeśli zdążysz
// zareagować w aplikacji, mail w ogóle nie poleci.
//
// Wywoływane przez cron (nagłówek x-import-secret) co 15 minut.
// Wysyłka idzie przez konto Google podłączone w module Google Workspace.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { serviceClient, getToken, getOwnerUserId } from '@/lib/przetargi-mail'

export const maxDuration = 60

const SECRET      = process.env.PRZETARGI_MAIL_SECRET ?? 'horeca2026'
const OPOZNIENIE  = Number(process.env.POWIADOMIENIA_OPOZNIENIE_MIN ?? 10)
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://horeca-crm.vercel.app'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function wyslijMail(token: string, to: string, subject: string, html: string) {
  const lines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html).toString('base64'),
  ]
  const raw = Buffer.from(lines.join('\r\n')).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error(d.error?.message ?? `Gmail HTTP ${r.status}`)
  }
}

export async function POST(req: NextRequest) {
  const supabase = serviceClient()

  let body: any = {}
  try { body = await req.json() } catch { /* cron wysyła puste body */ }
  if (req.headers.get('x-import-secret') !== SECRET && !body.userId) {
    return NextResponse.json({ ok: false, error: 'Brak autoryzacji' }, { status: 401 })
  }

  const prog = new Date(Date.now() - OPOZNIENIE * 60000).toISOString()

  const { data: doWyslania } = await supabase
    .from('powiadomienia')
    .select('id, odbiorca_id, tytul, tresc, link, created_at')
    .is('wyslane_mailem_at', null)
    .eq('przeczytane', false)
    .lt('created_at', prog)
    .order('created_at', { ascending: true })
    .limit(200)

  if (!doWyslania?.length) {
    return NextResponse.json({ ok: true, wyslano: 0, komunikat: 'Nic nie czeka na wysyłkę.' })
  }

  // Jedno konto Google obsługuje wysyłkę dla całej firmy
  const ownerId = await getOwnerUserId(supabase)
  const token   = ownerId ? await getToken(supabase, ownerId) : null
  if (!token) {
    return NextResponse.json({
      ok: false, error: 'no_token',
      komunikat: 'Brak połączenia z Google — powiadomienia czekają w aplikacji. '
               + 'Połącz konto w module Google Workspace.',
      oczekuje: doWyslania.length,
    }, { status: 503 })
  }

  // Adresy odbiorców
  const ids = Array.from(new Set(doWyslania.map(p => p.odbiorca_id)))
  const { data: profile } = await supabase
    .from('profiles').select('id, login, imie_nazwisko').in('id', ids)

  const adres = new Map((profile ?? []).map(p => [p.id, p.login]))
  const imie  = new Map((profile ?? []).map(p => [p.id, p.imie_nazwisko]))

  let wyslano = 0, bledy = 0
  const log: string[] = []

  for (const uid of ids) {
    const mail = adres.get(uid)
    const moje = doWyslania.filter(p => p.odbiorca_id === uid)

    if (!mail || !mail.includes('@')) {
      log.push(`Pominięto ${uid} — brak adresu e-mail w profilu`)
      continue
    }

    const pozycje = moje.map(p => `
      <li style="margin:0 0 12px 0">
        <strong style="color:#14171C">${escapeHtml(p.tytul)}</strong>
        ${p.tresc ? `<br><span style="color:#4A525C">${escapeHtml(p.tresc)}</span>` : ''}
      </li>`).join('')

    const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <p style="margin:0 0 4px 0;font-size:13px;color:#5A6472">HoReCa CRM</p>
  <h1 style="margin:0 0 16px 0;font-size:20px;color:#14171C">
    ${moje.length === 1 ? 'Jedna pozycja czeka na Ciebie' : `${moje.length} pozycji czeka na Ciebie`}
  </h1>
  <ul style="margin:0 0 24px 0;padding:0 0 0 18px;font-size:15px;line-height:1.5">${pozycje}</ul>
  <a href="${APP_URL}/akceptacje"
     style="display:inline-block;background:#0F5C56;color:#fff;text-decoration:none;
            padding:11px 20px;border-radius:10px;font-size:15px;font-weight:600">
    Otwórz w aplikacji
  </a>
  <p style="margin:24px 0 0 0;font-size:12px;color:#9AA3AD">
    Wiadomość wysłana automatycznie, bo pozycje nie zostały otwarte w aplikacji
    przez ${OPOZNIENIE} minut.
  </p>
</div>`

    try {
      await wyslijMail(token, mail,
        moje.length === 1 ? moje[0].tytul : `HoReCa CRM — ${moje.length} pozycji do przejrzenia`,
        html)

      await supabase.from('powiadomienia')
        .update({ wyslane_mailem_at: new Date().toISOString() })
        .in('id', moje.map(p => p.id))

      wyslano += moje.length
      log.push(`✓ ${mail}: ${moje.length} pozycji${imie.get(uid) ? ` (${imie.get(uid)})` : ''}`)
    } catch (ex: any) {
      bledy++
      log.push(`✗ ${mail}: ${ex.message}`)
    }
  }

  return NextResponse.json({
    ok: true, wyslano, bledy, odbiorcow: ids.length,
    komunikat: wyslano > 0 ? `Wysłano ${wyslano} powiadomień do ${ids.length} odbiorców`
                           : 'Nic nie wysłano',
    log,
  })
}

// Podgląd kolejki — bez wysyłki
export async function GET() {
  const supabase = serviceClient()
  const prog = new Date(Date.now() - OPOZNIENIE * 60000).toISOString()

  const [{ count: czeka }, { count: gotowe }] = await Promise.all([
    supabase.from('powiadomienia').select('*', { count: 'exact', head: true })
      .is('wyslane_mailem_at', null).eq('przeczytane', false),
    supabase.from('powiadomienia').select('*', { count: 'exact', head: true })
      .is('wyslane_mailem_at', null).eq('przeczytane', false).lt('created_at', prog),
  ])

  const ownerId = await getOwnerUserId(supabase)
  const token   = ownerId ? await getToken(supabase, ownerId) : null

  return NextResponse.json({
    opoznienie_minut: OPOZNIENIE,
    nieprzeczytane_bez_maila: czeka ?? 0,
    gotowe_do_wyslania: gotowe ?? 0,
    google_polaczone: !!token,
  })
}
