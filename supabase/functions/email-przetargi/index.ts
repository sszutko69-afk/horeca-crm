import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const NADAWCY_ZRODLA: Record<string, string> = {
  'connect.orlen.pl':           'connect_orlen',
  'orlen.pl':                   'connect_orlen',
  'psgaz.pl':                   'connect_orlen',
  'eb2b.com.pl':                'eb2b',
  'platforma.eb2b.com.pl':      'eb2b',
  'eprzetargi.pl':              'eprzetargi',
  'e-przetargi.pl':             'eprzetargi',
  'funduszeeuropejskie.gov.pl': 'baza_konkurencyjnosci',
  'ezamowienia.gov.pl':         'bzp',
  'ted.europa.eu':              'ted',
}

function wykryjZrodlo(from: string): string {
  const m = from.match(/@([\w.-]+)/)
  if (!m) return 'inne'
  const domain = m[1].toLowerCase()
  for (const [klucz, zrodlo] of Object.entries(NADAWCY_ZRODLA)) {
    if (domain.includes(klucz)) return zrodlo
  }
  return 'inne'
}

function extractDate(text: string): string {
  const patterns = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{2})\.(\d{2})\.(\d{4})/,
    /(\d{2})\/(\d{2})\/(\d{4})/,
  ]
  for (const pat of patterns) {
    const m = text.match(pat)
    if (m) {
      if (m[1].length === 4) return `${m[1]}-${m[2]}-${m[3]}`
      return `${m[3]}-${m[2]}-${m[1]}`
    }
  }
  // Fallback: +30 dni
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function extractWartosc(text: string): number | null {
  const m = text.match(/([\d\s]+(?:[,.]\d+)?)\s*(PLN|zł|EUR)/i)
  if (!m) return null
  const n = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s"<>]+/i)
  return m ? m[0] : null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let payload: any = {}
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), { status: 400 })
  }

  // Loguj cały payload żeby zobaczyć strukturę
  console.log('[email-przetargi] RAW payload keys:', Object.keys(payload))
  console.log('[email-przetargi] payload.type:', payload.type)

  // Resend wysyła event w formacie: { type: 'email.received', data: { ... } }
  // ale też może wysłać bezpośrednio pola emaila
  let emailData: any = payload

  if (payload.type === 'email.received' && payload.data) {
    emailData = payload.data
    console.log('[email-przetargi] Resend event format, data keys:', Object.keys(payload.data))
  }

  // Wyciągnij pola emaila — próbuj wszystkie możliwe nazwy pól
  const subject = (
    emailData.subject ??
    emailData.Subject ??
    emailData.headers?.subject ??
    payload.subject ??
    'Brak tematu'
  ).trim()

  const from = (
    emailData.from ??
    emailData.From ??
    emailData.sender ??
    emailData.from_address ??
    payload.from ??
    ''
  ).trim()

  const bodyText = (
    emailData.text ??
    emailData.plain_text ??
    emailData.body_plain ??
    emailData.plain ??
    payload.text ??
    ''
  )

  const bodyHtml = (
    emailData.html ??
    emailData.body_html ??
    emailData.Html ??
    payload.html ??
    ''
  )

  const body = bodyText || bodyHtml.replace(/<[^>]+>/g, ' ')

  console.log('[email-przetargi] Od:', from, '| Temat:', subject)
  console.log('[email-przetargi] Body length:', body.length)

  // SŁOWA KLUCZOWE — rozszerzona lista, case-insensitive
  const cały_tekst = (subject + ' ' + body).toLowerCase()
  const keywords = [
    // Ogólne — przetargi
    'przetarg', 'postępowanie', 'postepowanie',
    'zamówienie', 'zamowienie', 'ofert',
    'rfq', 'zapytanie', 'ogłoszenie', 'ogloszenie',
    'zapytanie ofertowe', 'specyfikacja', 'swz', 'siwz',

    // Gaz i LPG
    'lpg', 'gaz', 'gazowni', 'gazociąg', 'gazociag',
    'sieć gazowa', 'siec gazowa', 'przyłącz', 'przylacz',
    'stacja gazu', 'instalacja gazowa', 'dystrybucja gazu',
    'paliw', 'propan', 'butan', 'skroplony',

    // Budownictwo i infrastruktura
    'budowa', 'przebudowa', 'modernizacja', 'rozbudowa',
    'roboty budowlan', 'roboty ziemn', 'wykop',
    'rurociąg', 'rurociag', 'rur', 'armatur',
    'spawanie', 'spawalni', 'montaż', 'montaz',
    'infrastruktur', 'sieć', 'siec', 'przyłącze', 'przylacze',
    'instalacja', 'remont',

    // Projektowanie
    'projekt', 'dokumentacja', 'projektow',
    'nadzór', 'nadzor', 'inżynier', 'inzynier',

    // Dostawy materiałów
    'rury', 'kształtki', 'ksztaltki', 'zawory',
    'reduktor', 'licznik', 'gazomierz', 'regulator',

    // Platformy i źródła
    'connect', 'eb2b', 'orlen', 'psg', 'psgaz',
    'ezamowienia', 'bzp',
  ]

  const isPrezetarg = keywords.some(k => cały_tekst.includes(k))

  if (!isPrezetarg) {
    console.log('[email-przetargi] Pominięto — brak słów kluczowych. Temat:', subject)
    console.log('[email-przetargi] Pierwsze 200 znaków body:', body.substring(0, 200))
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'not_przetarg', subject }))
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const zrodlo = wykryjZrodlo(from)

  // Sprawdź duplikat
  const { data: istniejacy } = await supabase
    .from('przetargi')
    .select('id')
    .eq('tytul', subject)
    .eq('zrodlo', zrodlo)
    .maybeSingle()

  if (istniejacy) {
    console.log('[email-przetargi] Duplikat, pomijam:', subject)
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'duplicate' }))
  }

  const dataSkladania = extractDate(body + ' ' + subject)
  const wartoscNetto = extractWartosc(body)
  const urlOgloszenia = extractUrl(body)

  const { data: nowy, error } = await supabase
    .from('przetargi')
    .insert({
      tytul: subject || 'Email z przetargiem',
      zamawiajacy: from || null,
      wartosc_netto: wartoscNetto,
      data_skladania: dataSkladania,
      zrodlo,
      'url_ogloszenia': urlOgloszenia,
      status: 'nowy',
      priorytet: 0,
      uwagi: `Email od: ${from}\n\n${body.substring(0, 500)}`,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[email-przetargi] Błąd insert:', error.message)
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })
  }

  console.log('[email-przetargi] ✓ Dodano przetarg ID:', nowy?.id, '| Temat:', subject)
  return new Response(JSON.stringify({ ok: true, id: nowy?.id, tytul: subject, zrodlo }))
})
