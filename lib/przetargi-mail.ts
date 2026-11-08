// ═══════════════════════════════════════════════════════════════════════════
// Parser maili z przetargami — wspólny dla importu ręcznego i automatycznego
//
// Używany przez:
//   app/api/google/import-przetarg/route.ts   (ręczny, wybrane maile z Gmaila)
//   app/api/przetargi/import-mail/route.ts    (automatyczny, etykieta Przetargi)
//
// Logika parsowania pochodzi z działającego importu ręcznego — nie zmieniana.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Token Google ──────────────────────────────────────────────────────────
// Zwraca access_token albo null. Przy null wołający powinien zgłosić
// użytkownikowi potrzebę ponownego połączenia konta Google.
export async function getToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('user_google_tokens')
    .select('access_token, expires_at, refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return null
  if (new Date(data.expires_at) >= new Date()) return data.access_token
  if (!data.refresh_token) return null

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const d = await r.json()
  if (!d.access_token) return null

  await supabase
    .from('user_google_tokens')
    .update({
      access_token: d.access_token,
      expires_at: new Date(Date.now() + d.expires_in * 1000).toISOString(),
    })
    .eq('user_id', userId)

  return d.access_token
}

// Właściciel integracji Gmail — przy wywołaniu z crona nie ma sesji
// użytkownika, więc bierzemy konto, które połączyło Google.
export async function getOwnerUserId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase
    .from('user_google_tokens')
    .select('user_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
  return data?.[0]?.user_id ?? null
}

// ── Pomocnicze ────────────────────────────────────────────────────────────
export function getHeader(h: { name: string; value: string }[], name: string) {
  return h?.find(x => x.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function decodeB64(s: string): string {
  try {
    return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<\/th>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Wyciąga tekst z MIME payload (multipart/alternative, multipart/mixed, HTML)
export function extractText(payload: any, depth = 0): string {
  if (!payload || depth > 8) return ''

  const parts = payload.parts ?? []
  const plains: string[] = []
  const htmls: string[] = []

  for (const p of parts) {
    if (p.mimeType === 'text/plain' && p.body?.data) {
      plains.push(decodeB64(p.body.data))
    } else if (p.mimeType === 'text/html' && p.body?.data) {
      htmls.push(htmlToText(decodeB64(p.body.data)))
    } else if (p.mimeType?.startsWith('multipart/')) {
      const sub = extractText(p, depth + 1)
      if (sub) plains.push(sub)
    }
  }

  if (plains.length) return plains.join('\n\n')
  if (htmls.length) return htmls.join('\n\n')

  if (payload.body?.data) {
    const t = decodeB64(payload.body.data)
    return payload.mimeType === 'text/html' ? htmlToText(t) : t
  }
  return ''
}

export function extractDate(text: string): string {
  const pats = [
    /(202\d)-(0\d|1[012])-([012]\d|3[01])/,
    /([012]\d|3[01])\.(0\d|1[012])\.(202\d)/,
    /([012]\d|3[01])\/(0\d|1[012])\/(202\d)/,
  ]
  for (const p of pats) {
    const m = text.match(p)
    if (m) {
      if (m[1].startsWith('20')) return `${m[1]}-${m[2]}-${m[3]}`
      if (m[3]?.startsWith('20')) return `${m[3]}-${m[2]}-${m[1]}`
    }
  }
  return new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0]
}

export function extractWartosc(text: string): number | null {
  const m = text.match(/([\d\s]{3,}(?:[,.]\d+)?)\s*(PLN|zł|EUR)/i)
  if (!m) return null
  const n = parseFloat(m[1].replace(/[\s ]/g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

export function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s"<>)]+/)
  return m ? m[0].replace(/[.,;)>]+$/, '') : null
}

export function wykryjZrodlo(from: string, subject: string): string {
  const f = from.toLowerCase()
  const s = subject.toLowerCase()
  if (f.includes('orlen') || f.includes('connect.') || f.includes('psgaz') || f.includes('pgnig')) return 'connect_orlen'
  if (f.includes('eb2b')) return 'eb2b'
  if (f.includes('eprzetargi') || f.includes('e-przetargi') || s.includes('eprzetargi')) return 'eprzetargi'
  if (f.includes('ezamowienia') || s.includes('bzp') || s.includes('biuletyn zamówień')) return 'bzp'
  if (f.includes('ted.europa')) return 'ted'
  return 'inne'
}

// ══════════════════════════════════════════════════════════════════════════
// PARSER MAILI ZBIORCZYCH — jeden mail może zawierać wiele postępowań
// ══════════════════════════════════════════════════════════════════════════
export interface ParsedPrzetarg {
  tytul: string
  numer: string | null
  data_skladania: string
  wartosc_netto: number | null
  url_ogloszenia: string | null
  opis: string
}

export function parsujMail(body: string, subject: string, from: string): ParsedPrzetarg[] {
  const wyniki: ParsedPrzetarg[] = []
  const log: string[] = []

  // ── 1. Bloki "Numer postępowania:" (ORLEN Connect) ──
  const NUMER_BLOK_RE = /(?:Numer\s+(?:postępowania|zapytania|przetargu|ogłoszenia|zlecenia)\s*[:\-]?\s*)([\w\/\-\.]+\d[\w\/\-\.]*)/gi
  const numeryBloki = [...body.matchAll(NUMER_BLOK_RE)]
  log.push(`Wzorzec 1 (blok Numer): ${numeryBloki.length} trafień`)

  if (numeryBloki.length >= 1) {
    const splitRe = /(?:Numer\s+(?:postępowania|zapytania|przetargu|ogłoszenia|zlecenia)\s*[:\-]?\s*[\w\/\-\.]+\d[\w\/\-\.]*)/gi
    const chunks = body.split(splitRe)
    const numerValues = [...body.matchAll(splitRe)].map(m =>
      m[0].replace(/Numer\s+\w+\s*[:\-]?\s*/i, '').trim()
    )

    for (let i = 0; i < numerValues.length; i++) {
      const numer = numerValues[i]
      const tresc = chunks[i + 1] ?? ''

      const tytulMatch = tresc.match(/(?:Temat|Tytu[łl]|Przedmiot|Opis)\s*[:\-]\s*([^\n]{10,300})/i)
      const tytulAlt = tresc.split('\n').map(l => l.trim())
        .find(l => l.length > 15 && !l.match(/^\d|^data|^termin|^wartość/i))
      const tytul = (tytulMatch?.[1] ?? tytulAlt ?? `${numer} — ${subject}`).trim().substring(0, 300)

      wyniki.push({
        tytul: `${numer} — ${tytul}`,
        numer,
        data_skladania: extractDate(tresc),
        wartosc_netto: extractWartosc(tresc),
        url_ogloszenia: extractUrl(tresc),
        opis: `📋 Nr: ${numer}\n📧 Od: ${from}\n\n${tresc.trim().substring(0, 800)}`,
      })
    }
    if (wyniki.length >= 1) return wyniki
  }

  // ── 2. Numery postępowań inline (PSG/ZO/RFQ/ZP itp.) ──
  const NUMER_RE = /\b((?:PSG|ZO|RFQ|RF|PN|ZP|PK|ZZP|DZ|IN|ZAP|ZKP|SZP|WZPO|EZO|NZO|AZ|KSP)[\-\/][\w\/\-\.]+\d+[\w\/\-\.]*)\b/gi
  const numeryInline = [...body.matchAll(NUMER_RE)]
  log.push(`Wzorzec 2 (numery inline): ${numeryInline.length} trafień`)

  if (numeryInline.length >= 2) {
    const splitRe = /\b(?:PSG|ZO|RFQ|RF|PN|ZP|PK|ZZP|DZ|IN|ZAP|ZKP|SZP|WZPO|EZO|NZO|AZ|KSP)[\-\/][\w\/\-\.]+\d+[\w\/\-\.]*/gi
    const parts = body.split(splitRe)
    const nrs = [...body.matchAll(splitRe)].map(m => m[0].trim())

    for (let i = 0; i < nrs.length; i++) {
      const numer = nrs[i]
      const tresc = (parts[i + 1] ?? '').trim()
      if (!tresc || tresc.length < 10) continue

      const linie = tresc.split('\n').map(l => l.trim()).filter(l => l.length > 5)
      const tytulRaw = linie[0] ?? subject

      wyniki.push({
        tytul: `${numer} — ${tytulRaw.substring(0, 250)}`,
        numer,
        data_skladania: extractDate(tresc),
        wartosc_netto: extractWartosc(tresc),
        url_ogloszenia: extractUrl(tresc)
          ?? (from.toLowerCase().includes('orlen') ? 'https://connect.orlen.pl' : null),
        opis: `📋 Nr: ${numer}\n📧 Od: ${from}\n\n${tresc.substring(0, 800)}`,
      })
    }
    if (wyniki.length >= 2) return wyniki
  }

  // ── 3. Bloki oddzielone separatorami ──
  const sekcje = body.split(/(?:_{3,}|-{3,}|={3,}|\*{3,})/).map(s => s.trim()).filter(s => s.length > 50)
  log.push(`Wzorzec 3 (separatory): ${sekcje.length} sekcji`)

  if (sekcje.length >= 2) {
    for (const sek of sekcje.slice(0, 20)) {
      const linie = sek.split('\n').map(l => l.trim()).filter(l => l.length > 10)
      if (!linie.length) continue
      const tytulRaw = linie.find(l => l.length > 15 && !l.match(/^(Data|Termin|Wartość|URL|Numer|http)/i)) ?? linie[0]
      if (!tytulRaw || tytulRaw.length < 10) continue

      wyniki.push({
        tytul: tytulRaw.substring(0, 300).replace(/^[\d.):*\-\s]+/, '').trim(),
        numer: sek.match(/\b([A-Z]{2,6}[\-\/][\w\/\-\.]+\d+)\b/)?.[1] ?? null,
        data_skladania: extractDate(sek),
        wartosc_netto: extractWartosc(sek),
        url_ogloszenia: extractUrl(sek),
        opis: `📧 Od: ${from}\n\n${sek.substring(0, 800)}`,
      })
    }
    if (wyniki.length >= 2) return wyniki
  }

  // ── 4. Wiersze tabeli (maile HTML) ──
  const TABLE_RE = /\|\s*([A-ZŁĆŚÓŹŻĄĘ][^\|]{15,200})\s*\|/g
  const tableRows = [...body.matchAll(TABLE_RE)]
  log.push(`Wzorzec 4 (tabela): ${tableRows.length} wierszy`)

  if (tableRows.length >= 2) {
    for (const row of tableRows.slice(0, 20)) {
      const cel = row[1].trim()
      if (cel.length < 10) continue
      const idx = body.indexOf(row[0])
      const ctx = body.substring(Math.max(0, idx - 100), idx + 500)

      wyniki.push({
        tytul: cel.substring(0, 300),
        numer: ctx.match(/\b([A-Z]{2,6}[\-\/][\w\/\-\.]+\d+)\b/)?.[1] ?? null,
        data_skladania: extractDate(ctx),
        wartosc_netto: extractWartosc(ctx),
        url_ogloszenia: extractUrl(ctx),
        opis: `📧 Od: ${from}\n\n${ctx.substring(0, 800)}`,
      })
    }
    if (wyniki.length >= 2) return wyniki
  }

  // ── 5. Lista numerowana ──
  const LISTA_RE = /(?:^|\n)\s*(\d+)[.):]\s+([A-ZŁĆŚÓŹŻĄĘ][^\n]{15,300})/gm
  const lista = [...body.matchAll(LISTA_RE)]
  log.push(`Wzorzec 5 (lista): ${lista.length} pozycji`)

  if (lista.length >= 2) {
    for (const m of lista.slice(0, 20)) {
      const idx = body.indexOf(m[0])
      const ctx = body.substring(Math.max(0, idx), idx + 500)

      wyniki.push({
        tytul: m[2].trim().substring(0, 300),
        numer: null,
        data_skladania: extractDate(ctx),
        wartosc_netto: extractWartosc(ctx),
        url_ogloszenia: extractUrl(ctx),
        opis: `📧 Od: ${from}\n\n${ctx.substring(0, 800)}`,
      })
    }
    if (wyniki.length >= 2) return wyniki
  }

  // ── 6. "Tytuł/Przedmiot:" ──
  const TYTUL_RE = /(?:Tytu[łl]|Przedmiot|Nazwa|Opis)\s*[:\-]\s*([^\n]{15,300})/gi
  const tytuly = [...body.matchAll(TYTUL_RE)]
  log.push(`Wzorzec 6 (tytuly): ${tytuly.length} pozycji`)

  if (tytuly.length >= 2) {
    for (const m of tytuly.slice(0, 20)) {
      const idx = body.indexOf(m[0])
      const ctx = body.substring(Math.max(0, idx - 50), idx + 600)

      wyniki.push({
        tytul: m[1].trim().substring(0, 300),
        numer: ctx.match(/\b([A-Z]{2,6}[\-\/][\w\/\-\.]+\d+)\b/)?.[1] ?? null,
        data_skladania: extractDate(ctx),
        wartosc_netto: extractWartosc(ctx),
        url_ogloszenia: extractUrl(ctx),
        opis: `📧 Od: ${from}\n\n${ctx.substring(0, 800)}`,
      })
    }
    if (wyniki.length >= 2) return wyniki
  }

  // ── Fallback: jeden przetarg z tematu maila ──
  log.push('Fallback: jeden przetarg z tematu')
  return [{
    tytul: subject || 'Przetarg z maila',
    numer: subject?.match(/\b([A-Z]{2,6}[\-\/][\w\/\-\.]+\d+)\b/)?.[1] ?? null,
    data_skladania: extractDate(body + ' ' + subject),
    wartosc_netto: extractWartosc(body),
    url_ogloszenia: extractUrl(body),
    opis: `📧 Od: ${from}\n📋 Temat: ${subject}\n\nWzorce: ${log.join(' | ')}\n\n${body.substring(0, 1000)}`,
  }]
}

// ── Czy taki przetarg już jest w bazie ────────────────────────────────────
export async function czyDuplikat(
  supabase: SupabaseClient,
  p: ParsedPrzetarg
): Promise<boolean> {
  // 1. Po numerze postępowania — najdokładniejsze
  if (p.numer) {
    const { data } = await supabase
      .from('przetargi')
      .select('id')
      .ilike('tytul', `%${p.numer.substring(0, 25)}%`)
      .limit(1)
    if (data && data.length > 0) return true
  }

  // 2. Po fragmencie tytułu
  if (p.tytul.length > 20) {
    const fragment = p.tytul.substring(0, 60).replace(/[%_]/g, '')
    const { data } = await supabase
      .from('przetargi')
      .select('id')
      .ilike('tytul', `%${fragment}%`)
      .limit(1)
    if (data && data.length > 0) return true
  }

  return false
}
