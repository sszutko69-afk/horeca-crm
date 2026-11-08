// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATYCZNY IMPORT PRZETARGÓW Z ETYKIETY GMAIL
//
// Czyta maile z etykiety „Przetargi" (konfigurowalna przez PRZETARGI_GMAIL_LABEL),
// parsuje je i wrzuca postępowania do tabeli przetargi.
//
// Dwa tryby wywołania:
//   1. Cron / Supabase pg_cron — nagłówek x-import-secret
//   2. Przycisk w aplikacji     — body { userId }
//
// Każdy przetworzony mail trafia do przetargi_mail_log, więc kolejny przebieg
// go pomija. Maile w Gmailu nie są modyfikowane ani oznaczane.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import {
  serviceClient, getToken, getOwnerUserId, getHeader,
  extractText, wykryjZrodlo, parsujMail, czyDuplikat,
} from '@/lib/przetargi-mail'

export const maxDuration = 60

const LABEL      = process.env.PRZETARGI_GMAIL_LABEL ?? 'Przetargi'
const SECRET     = process.env.PRZETARGI_MAIL_SECRET ?? 'gazcrm2025'
const OKNO_DNI   = process.env.PRZETARGI_MAIL_OKNO ?? '60d'
const MAX_MAILI  = 40

export async function POST(req: NextRequest) {
  const supabase = serviceClient()
  const log: string[] = []

  // ── Autoryzacja ─────────────────────────────────────────────────────────
  let body: any = {}
  try { body = await req.json() } catch { /* cron potrafi wysłać puste body */ }

  const sekretOk = req.headers.get('x-import-secret') === SECRET
  if (!sekretOk && !body.userId) {
    return NextResponse.json({ ok: false, error: 'Brak autoryzacji' }, { status: 401 })
  }

  // ── Konto Google ────────────────────────────────────────────────────────
  const userId = body.userId ?? await getOwnerUserId(supabase)
  if (!userId) {
    return NextResponse.json({
      ok: false, error: 'no_account',
      komunikat: 'Żadne konto nie ma połączonego Gmaila. Połącz konto w module Google Workspace.',
    }, { status: 400 })
  }

  const token = await getToken(supabase, userId)

  // Pobierz info o podłączonym koncie Google — ważne do diagnozy
  const { data: kontoInfo } = await supabase
    .from('user_google_tokens')
    .select('google_email, expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  const googleEmail = kontoInfo?.google_email ?? null

  if (!token) {
    return NextResponse.json({
      ok: false, error: 'no_token',
      google_konto: googleEmail,
      komunikat: `Wygasło połączenie z Google${googleEmail ? ` (${googleEmail})` : ''}. `
               + 'Wejdź w Ustawienia → Google Workspace i połącz konto ponownie.',
    }, { status: 401 })
  }

  // ── Lista maili z etykiety ──────────────────────────────────────────────
  const query = `label:${LABEL} newer_than:${OKNO_DNI}`
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages`
      + `?maxResults=${MAX_MAILI}&q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}))
    return NextResponse.json({
      ok: false, error: 'gmail_error',
      google_konto: googleEmail,
      komunikat: `Gmail odrzucił zapytanie: ${err.error?.message ?? listRes.status}`,
    }, { status: 502 })
  }

  const listData = await listRes.json()
  const wszystkie: { id: string }[] = listData.messages ?? []

  if (!wszystkie.length) {
    return NextResponse.json({
      ok: true, dodano: 0, maili: 0, pominiete: 0,
      google_konto: googleEmail,
      komunikat: `Konto: ${googleEmail ?? '?'} | Etykieta „${LABEL}" nie ma maili z ostatnich ${OKNO_DNI}. `
               + 'Sprawdź, czy filtr w Gmailu nadaje tę etykietę.',
    })
  }

  // ── Odsiej już przetworzone ─────────────────────────────────────────────
  const ids = wszystkie.map(m => m.id)
  const { data: juz } = await supabase
    .from('przetargi_mail_log')
    .select('message_id')
    .in('message_id', ids)

  const przetworzone = new Set((juz ?? []).map(r => r.message_id))
  const nowe = ids.filter(id => !przetworzone.has(id))

  log.push(`Etykieta „${LABEL}": ${ids.length} maili, nowych ${nowe.length}`)

  if (!nowe.length) {
    return NextResponse.json({
      ok: true, dodano: 0, maili: ids.length, pominiete: ids.length,
      komunikat: `Wszystkie ${ids.length} maili z etykiety były już przetworzone.`,
      log,
    })
  }

  // ── Przetwarzanie ───────────────────────────────────────────────────────
  let dodano = 0, duplikaty = 0, bledy = 0
  const dodanePrzetargi: any[] = []

  for (const msgId of nowe) {
    let temat = '', nadawca = '', zrodlo = 'inne'
    let dodanoZMaila = 0, duplikatyZMaila = 0
    let bladMaila: string | null = null
    let dataMaila: string | null = null

    try {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!r.ok) throw new Error(`Gmail HTTP ${r.status}`)

      const msg = await r.json()
      const headers = msg.payload?.headers ?? []
      temat   = getHeader(headers, 'Subject')
      nadawca = getHeader(headers, 'From')
      zrodlo  = wykryjZrodlo(nadawca, temat)
      dataMaila = msg.internalDate
        ? new Date(parseInt(msg.internalDate)).toISOString()
        : null

      const tresc = extractText(msg.payload)
      log.push(`📧 "${temat.substring(0, 60)}" | ${zrodlo} | ${tresc.length}zn`)

      if (!tresc || tresc.length < 20) {
        bladMaila = 'puste body'
        log.push('  ⚠ Puste body — pomijam')
      } else {
        const parsed = parsujMail(tresc, temat, nadawca)
        log.push(`  → ${parsed.length} postępowań`)

        for (const p of parsed) {
          if (await czyDuplikat(supabase, p)) {
            duplikatyZMaila++
            continue
          }

          const { data: nowy, error } = await supabase.from('przetargi').insert({
            tytul:            p.tytul.substring(0, 500),
            zamawiajacy:      nadawca.replace(/<[^>]+>/g, '').trim().substring(0, 200),
            wartosc_netto:    p.wartosc_netto,
            data_skladania:   p.data_skladania,
            data_publikacji:  dataMaila ? dataMaila.split('T')[0] : null,
            zrodlo,
            url_ogloszenia:   p.url_ogloszenia,
            url_postepowania: p.url_ogloszenia,
            status:           'nowy',
            priorytet:        zrodlo === 'connect_orlen' ? 1 : 0,
            usuniete:         false,
            zarchiwizowany:   false,
            uwagi:            p.opis.substring(0, 2000),
          }).select('id, tytul').single()

          if (error) {
            bledy++
            log.push(`  ✗ ${error.message}`)
          } else {
            dodanoZMaila++
            if (nowy) dodanePrzetargi.push(nowy)
          }
        }
      }
    } catch (ex: any) {
      bladMaila = ex.message
      bledy++
      log.push(`  ✗ Wyjątek: ${ex.message}`)
    }

    dodano    += dodanoZMaila
    duplikaty += duplikatyZMaila

    // Zapis do logu — także przy błędzie, żeby nie zapętlić się na jednym mailu
    await supabase.from('przetargi_mail_log').upsert({
      message_id: msgId,
      temat:      temat.substring(0, 500),
      nadawca:    nadawca.substring(0, 300),
      zrodlo,
      dodano:     dodanoZMaila,
      duplikaty:  duplikatyZMaila,
      blad:       bladMaila,
      data_maila: dataMaila,
    }, { onConflict: 'message_id' })
  }

  const komunikat = dodano > 0
    ? `Dodano ${dodano} przetarg(i) z ${nowe.length} maili`
      + (duplikaty > 0 ? ` · ${duplikaty} już było w bazie` : '')
    : duplikaty > 0
      ? `Wszystkie postępowania z ${nowe.length} maili już są w bazie (${duplikaty})`
      : `Z ${nowe.length} maili nie udało się odczytać żadnego postępowania`

  return NextResponse.json({
    ok: true,
    dodano, duplikaty, bledy,
    maili: nowe.length,
    pominiete: ids.length - nowe.length,
    google_konto: googleEmail,
    przetargi: dodanePrzetargi,
    komunikat,
    log,
  })
}

// Podgląd stanu — bez importu. Przydatne do diagnozy z przeglądarki.
export async function GET() {
  const supabase = serviceClient()

  const [{ count: wLogu }, { data: ostatni }] = await Promise.all([
    supabase.from('przetargi_mail_log').select('*', { count: 'exact', head: true }),
    supabase.from('przetargi_mail_log')
      .select('temat, zrodlo, dodano, duplikaty, blad, przetworzono')
      .order('przetworzono', { ascending: false }).limit(10),
  ])

  const userId = await getOwnerUserId(supabase)
  const token  = userId ? await getToken(supabase, userId) : null

  // Które konto Google jest podłączone — jeśli inne niż się zakładało,
  // etykieta Przetargi po prostu nie zostanie znaleziona.
  const { data: konto } = await supabase
    .from('user_google_tokens')
    .select('google_email, scope, expires_at')
    .eq('user_id', userId ?? '')
    .maybeSingle()

  return NextResponse.json({
    etykieta: LABEL,
    okno: OKNO_DNI,
    google_polaczone: !!token,
    google_konto: konto?.google_email ?? '(nieznane — połącz konto ponownie)',
    token_wazny_do: konto?.expires_at ?? null,
    maili_w_logu: wLogu ?? 0,
    ostatnie: ostatni ?? [],
  })
}
