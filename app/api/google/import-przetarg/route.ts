import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getToken(userId: string): Promise<string | null> {
  const { data } = await supabase.from('user_google_tokens')
    .select('access_token, expires_at, refresh_token').eq('user_id', userId).maybeSingle()
  if (!data) return null
  if (new Date(data.expires_at) < new Date()) {
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
    if (d.access_token) {
      await supabase.from('user_google_tokens').update({
        access_token: d.access_token,
        expires_at: new Date(Date.now() + d.expires_in * 1000).toISOString(),
      }).eq('user_id', userId)
      return d.access_token
    }
    return null
  }
  return data.access_token
}

function getHeader(h: {name:string;value:string}[], name: string) {
  return h?.find(x => x.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function decodeB64(s: string): string {
  try { return Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf-8') }
  catch { return '' }
}

// ── Wyciągnij tekst z MIME payload (obsługuje multipart/alternative, multipart/mixed, HTML) ──
function extractText(payload: any, depth = 0): string {
  if (!payload || depth > 8) return ''
  
  const parts = payload.parts ?? []
  
  // Zbierz wszystkie części tekstu i HTML
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
  
  // Preferuj text/plain (lepiej dla parsowania struktury)
  if (plains.length) return plains.join('\n\n')
  if (htmls.length) return htmls.join('\n\n')
  
  // Bezpośrednie body
  if (payload.body?.data) {
    const t = decodeB64(payload.body.data)
    return payload.mimeType === 'text/html' ? htmlToText(t) : t
  }
  return ''
}

function htmlToText(html: string): string {
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

function extractDate(text: string): string {
  // Formaty dat: YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, "do DD miesiąc YYYY"
  const pats = [
    /(202\d)-(0\d|1[012])-([012]\d|3[01])/,
    /([012]\d|3[01])\.(0\d|1[012])\.(202\d)/,
    /([012]\d|3[01])\/(0\d|1[012])\/(202\d)/,
    /do\s+(\d{1,2})\s+(styczeń|luty|marca|kwiecień|maja|czerwiec|lipca|sierpień|września|październik|listopada|grudzień)/i,
  ]
  for (const p of pats) {
    const m = text.match(p)
    if (m) {
      if (m[1].startsWith('20')) return `${m[1]}-${m[2]}-${m[3]}`
      if (m[3]?.startsWith('20')) return `${m[3]}-${m[2]}-${m[1]}`
    }
  }
  return new Date(Date.now() + 21*86400000).toISOString().split('T')[0]
}

function extractWartosc(text: string): number|null {
  const m = text.match(/([\d\s]{3,}(?:[,.]\d+)?)\s*(PLN|zł|EUR)/i)
  if (!m) return null
  const n = parseFloat(m[1].replace(/[\s\u00a0]/g,'').replace(',','.'))
  return isNaN(n) ? null : n
}

function extractUrl(text: string): string|null {
  const m = text.match(/https?:\/\/[^\s"<>)]+/)
  return m ? m[0].replace(/[.,;)>]+$/,'') : null
}

function wykryjZrodlo(from: string, subject: string): string {
  const f = from.toLowerCase()
  const s = subject.toLowerCase()
  if (f.includes('orlen') || f.includes('connect.') || f.includes('psgaz') || f.includes('pgnig')) return 'connect_orlen'
  if (f.includes('eb2b')) return 'eb2b'
  if (s.includes('bzp') || s.includes('biuletyn zamówień')) return 'bzp'
  return 'inne'
}

// ══════════════════════════════════════════════════════════════════════════════
// PARSER MAILI ZBIORCZYCH — obsługuje różne formaty ORLEN Connect
// ══════════════════════════════════════════════════════════════════════════════
interface ParsedPrzetarg {
  tytul: string
  numer: string|null
  data_skladania: string
  wartosc_netto: number|null
  url_ogloszenia: string|null
  opis: string
}

function parsujMail(body: string, subject: string, from: string): ParsedPrzetarg[] {
  const wyniki: ParsedPrzetarg[] = []
  const log: string[] = []

  // ── 1. ORLEN Connect — format z "Numer postępowania:" lub "Numer zapytania:" ──
  // Wzorzec: bloki zaczynające się od numeru przetargu
  const NUMER_BLOK_RE = /(?:Numer\s+(?:postępowania|zapytania|przetargu|ogłoszenia|zlecenia)\s*[:\-]?\s*)([\w\/\-\.]+\d[\w\/\-\.]*)/gi
  const numeryBloki = [...body.matchAll(NUMER_BLOK_RE)]
  log.push(`Wzorzec 1 (blok Numer): ${numeryBloki.length} trafień`)

  if (numeryBloki.length >= 1) {
    // Podziel treść po każdym "Numer postępowania:"
    const splitRe = /(?:Numer\s+(?:postępowania|zapytania|przetargu|ogłoszenia|zlecenia)\s*[:\-]?\s*[\w\/\-\.]+\d[\w\/\-\.]*)/gi
    const chunks = body.split(splitRe)
    const numerValues = [...body.matchAll(splitRe)].map(m => m[0].replace(/Numer\s+\w+\s*[:\-]?\s*/i, '').trim())
    
    for (let i = 0; i < numerValues.length; i++) {
      const numer = numerValues[i]
      const tresc = chunks[i+1] ?? ''
      
      // Tytuł: szukaj "Temat:" lub "Tytuł:" lub pierwsza niepusta linia
      const tytulMatch = tresc.match(/(?:Temat|Tytu[łl]|Przedmiot|Opis)\s*[:\-]\s*([^\n]{10,300})/i)
      const tytulAlt = tresc.split('\n').map(l => l.trim()).find(l => l.length > 15 && !l.match(/^\d|^data|^termin|^wartość/i))
      const tytul = (tytulMatch?.[1] ?? tytulAlt ?? `${numer} — ${subject}`).trim().substring(0, 300)
      
      const url = extractUrl(tresc)
      wyniki.push({
        tytul: `${numer} — ${tytul}`,
        numer,
        data_skladania: extractDate(tresc),
        wartosc_netto: extractWartosc(tresc),
        url_ogloszenia: url,
        opis: `📋 Nr: ${numer}\n📧 Od: ${from}\n\n${tresc.trim().substring(0, 800)}`,
      })
    }
    if (wyniki.length >= 1) return wyniki
  }

  // ── 2. Wzorzec numerów postępowań inline (PSG/ZO/RFQ/ZP itp.) ──
  // Format ORLEN: "PSG/ZO-...", "ZO-...", "RFQ-...", "IN-..."
  const NUMER_RE = /\b((?:PSG|ZO|RFQ|RF|PN|ZP|PK|ZZP|DZ|IN|ZAP|ZKP|SZP|WZPO|EZO|NZO|AZ|KSP)[\-\/][\w\/\-\.]+\d+[\w\/\-\.]*)\b/gi
  const numeryInline = [...body.matchAll(NUMER_RE)]
  log.push(`Wzorzec 2 (numery inline): ${numeryInline.length} trafień`)
  
  if (numeryInline.length >= 2) {
    const splitRe = /\b(?:PSG|ZO|RFQ|RF|PN|ZP|PK|ZZP|DZ|IN|ZAP|ZKP|SZP|WZPO|EZO|NZO|AZ|KSP)[\-\/][\w\/\-\.]+\d+[\w\/\-\.]*/gi
    const parts = body.split(splitRe)
    const nrs = [...body.matchAll(splitRe)].map(m => m[0].trim())
    
    for (let i = 0; i < nrs.length; i++) {
      const numer = nrs[i]
      const tresc = (parts[i+1] ?? '').trim()
      if (!tresc || tresc.length < 10) continue
      
      // Pierwsze 2-3 słowa treści = opis, pomiń znaki specjalne
      const linie = tresc.split('\n').map(l => l.trim()).filter(l => l.length > 5)
      const tytulRaw = linie[0] ?? subject
      const tytul = `${numer} — ${tytulRaw.substring(0, 250)}`
      
      const url = extractUrl(tresc) ?? 
        (from.toLowerCase().includes('orlen') ? `https://connect.orlen.pl` : null)
      
      wyniki.push({
        tytul,
        numer,
        data_skladania: extractDate(tresc),
        wartosc_netto: extractWartosc(tresc),
        url_ogloszenia: url,
        opis: `📋 Nr: ${numer}\n📧 Od: ${from}\n\n${tresc.substring(0, 800)}`,
      })
    }
    if (wyniki.length >= 2) return wyniki
  }

  // ── 3. Bloki oddzielone separatorami (___,---,===) ──
  const sekcje = body.split(/(?:_{3,}|-{3,}|={3,}|\*{3,})/).map(s => s.trim()).filter(s => s.length > 50)
  log.push(`Wzorzec 3 (separatory): ${sekcje.length} sekcji`)
  
  if (sekcje.length >= 2) {
    for (const sek of sekcje.slice(0, 20)) {
      const linie = sek.split('\n').map(l => l.trim()).filter(l => l.length > 10)
      if (!linie.length) continue
      const tytulRaw = linie.find(l => l.length > 15 && !l.match(/^(Data|Termin|Wartość|URL|Numer|http)/i)) ?? linie[0]
      if (!tytulRaw || tytulRaw.length < 10) continue
      const numer = sek.match(/\b([A-Z]{2,6}[\-\/][\w\/\-\.]+\d+)\b/)?.[1] ?? null
      wyniki.push({
        tytul: tytulRaw.substring(0, 300).replace(/^[\d.):*\-\s]+/, '').trim(),
        numer,
        data_skladania: extractDate(sek),
        wartosc_netto: extractWartosc(sek),
        url_ogloszenia: extractUrl(sek),
        opis: `📧 Od: ${from}\n\n${sek.substring(0, 800)}`,
      })
    }
    if (wyniki.length >= 2) return wyniki
  }

  // ── 4. Wzorzec tabeli (często HTML maile ORLEN) ──
  // Wiersze tabeli często mają format: "Nr | Temat | Termin | Wartość"
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

  // ── 6. Wzorzec "Tytuł/Przedmiot:" ──
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

  // ── Fallback — jeden przetarg z tematu maila ──
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

export async function POST(req: NextRequest) {
  const { userId, messageIds } = await req.json()
  if (!userId || !messageIds?.length) {
    return NextResponse.json({ error: 'Brak parametrów' }, { status: 400 })
  }

  const token = await getToken(userId)
  if (!token) return NextResponse.json({ error: 'Brak tokenu Google' }, { status: 401 })

  let dodano = 0, duplikaty = 0, bledy = 0
  const log: string[] = []
  const dodanePrzetargi: any[] = []

  for (const msgId of messageIds) {
    try {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!r.ok) {
        bledy++
        log.push(`HTTP ${r.status} dla msg ${msgId}`)
        continue
      }
      const msg = await r.json()

      const headers = msg.payload?.headers ?? []
      const subject = getHeader(headers, 'Subject')
      const from    = getHeader(headers, 'From')
      const body    = extractText(msg.payload)

      log.push(`📧 "${subject}" | ${from.substring(0, 50)} | ${body.length}ch`)

      if (!body || body.length < 20) {
        log.push('  ⚠ Puste body — pomijam')
        continue
      }

      const zrodlo = wykryjZrodlo(from, subject)
      const parsed = parsujMail(body, subject, from)
      log.push(`  → Wykryto ${parsed.length} przetarg(i) [${zrodlo}]`)

      for (const p of parsed) {
        // Sprawdź duplikat — wiele strategii
        let isDuplicate = false
        
        // 1. Po numerze postępowania (najdokładniejsze)
        if (p.numer) {
          const { data: d1 } = await supabase.from('przetargi')
            .select('id').ilike('tytul', `%${p.numer.substring(0, 25)}%`)
            .eq('usuniete', false).limit(1)
          if (d1 && d1.length > 0) isDuplicate = true
        }
        
        // 2. Po tytule (pierwsze 60 znaków)
        if (!isDuplicate && p.tytul.length > 20) {
          const titleFragment = p.tytul.substring(0, 60).replace(/[%_]/g, '')
          const { data: d2 } = await supabase.from('przetargi')
            .select('id').ilike('tytul', `%${titleFragment}%`)
            .eq('usuniete', false).limit(1)
          if (d2 && d2.length > 0) isDuplicate = true
        }

        if (isDuplicate) {
          duplikaty++
          log.push(`  ⟳ Duplikat: ${p.tytul.substring(0, 60)}`)
          continue
        }

        const { data: nowy, error } = await supabase.from('przetargi').insert({
          tytul: p.tytul.substring(0, 500),
          zamawiajacy: from.replace(/<[^>]+>/g, '').trim().substring(0, 200),
          wartosc_netto: p.wartosc_netto,
          data_skladania: p.data_skladania,
          zrodlo,
          url_ogloszenia: p.url_ogloszenia,
          url_postepowania: p.url_ogloszenia,
          status: 'nowy',
          priorytet: zrodlo === 'connect_orlen' ? 1 : 0,
          usuniete: false,
          uwagi: p.opis.substring(0, 2000),
        }).select('id, tytul').single()

        if (error) {
          bledy++
          log.push(`  ✗ Błąd: ${error.message}`)
        } else {
          dodano++
          if (nowy) dodanePrzetargi.push(nowy)
          log.push(`  ✓ Dodano: ${p.tytul.substring(0, 60)}`)
        }
      }
    } catch (ex: any) {
      bledy++
      log.push(`  ✗ Wyjątek: ${ex.message}`)
    }
  }

  return NextResponse.json({
    ok: true, dodano, duplikaty, bledy,
    przetargi: dodanePrzetargi,
    komunikat: dodano > 0
      ? `✓ Dodano ${dodano} przetarg(i)`
      : `Duplikatów: ${duplikaty}, błędów: ${bledy}`,
    log,
  })
}
