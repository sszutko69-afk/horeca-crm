import { NextRequest, NextResponse } from 'next/server'

// Agent marketingowy Skrojo.pl → Facebook.
// Vercel Cron (pon/śr/pt, patrz vercel.json) wywołuje GET z nagłówkiem "Authorization: Bearer $CRON_SECRET".
// Agent: wybiera kąt i landing → prosi Claude o post po polsku → publikuje na stronie FB przez Graph API.
//
// Zmienne środowiskowe (Vercel → Settings → Environment Variables):
//   FB_PAGE_ID           ID strony Facebook skrojo.pl
//   FB_PAGE_TOKEN        długoterminowy token strony (Page Access Token)
//   ANTHROPIC_API_KEY    klucz do generowania treści
//   CRON_SECRET          dowolny długi losowy ciąg (Vercel dołącza go do wywołań crona)
//   FB_AUTOPUBLISH       "true" = publikuj od razu; brak = tryb roboczy (post niepublikowany, do akceptacji)
// Ręczny test: GET /api/agent/facebook?dry=1 (z Bearer CRON_SECRET) → zwraca tekst bez wysyłania na Facebooka.

import { podpisGrafiki } from '@/lib/agent-facebook'

const GRAPH = 'https://graph.facebook.com/v21.0'
const SITE = 'https://skrojo.pl'
const APP = 'https://app.skrojo.pl'

// Krótkie etykiety branż na grafice
const ETYKIETY: Record<string, string> = {
  horeca: 'HoReCa', kancelarie: 'Kancelarie', nieruchomosci: 'Nieruchomości', transport: 'Transport',
  logistyka: 'Logistyka', sekretariaty: 'Sekretariaty', inwestycyjna: 'Inwestycje',
}

// Fakty, na których wolno opierać reklamy (źródło: strona skrojo.pl). Model nie może dodawać własnych.
const FAKTY = `
- Skrojo to system CRM "szyty na miarę" firmy: klienci, sprzedaż, kadry, płace, dokumenty, asystent AI w jednym miejscu.
- Wersja podstawowa: 0 zł na zawsze. Wersje rozbudowane: od 29 zł miesięcznie.
- Rejestracja na stronie, okres próbny pełnej wersji 7 dni.
- Wersje branżowe: HoReCa (plan sali, rezerwacje, menu z alergenami, POS, terminal), kancelarie, nieruchomości, transport, logistyka, sekretariaty, inwestycje.
- Darmowe demo online do wypróbowania bez zobowiązań.
`.trim()

const BRANZE: { slug: string; nazwa: string }[] = [
  { slug: 'horeca', nazwa: 'restauracje, kawiarnie i hotele (HoReCa)' },
  { slug: 'kancelarie', nazwa: 'kancelarie i biura' },
  { slug: 'nieruchomosci', nazwa: 'agencje nieruchomości' },
  { slug: 'transport', nazwa: 'firmy transportowe' },
  { slug: 'logistyka', nazwa: 'firmy logistyczne' },
  { slug: 'sekretariaty', nazwa: 'sekretariaty i obsługa biura' },
  { slug: 'inwestycyjna', nazwa: 'firmy inwestycyjne i budowlane' },
]

const KATY = [
  'problem: dane klientów rozproszone w arkuszach i zeszytach, a jedno miejsce to rozwiązuje',
  'cena: zacznij za 0 zł, rozbudowuj dopiero gdy potrzebujesz (od 29 zł)',
  'szybki start: rejestracja, 7 dni pełnej wersji, bez instalacji',
  'czas: ile godzin tygodniowo tracisz na ręczne przepisywanie i szukanie informacji',
  'demo: zobacz system w działaniu zanim cokolwiek zapłacisz',
  'asystent AI w CRM: szybciej od pytania do odpowiedzi o klientach i sprzedaży',
  'porządek: jedno narzędzie zamiast pięciu aplikacji',
]

function wybierz(teraz: Date) {
  // Numer wpisu w roku (3 na tydzień) → deterministyczna rotacja branży i kąta, bez powtórzeń z rzędu
  const dzienRoku = Math.floor((teraz.getTime() - Date.UTC(teraz.getUTCFullYear(), 0, 0)) / 86400000)
  const nr = Math.floor(dzienRoku / 7) * 3 + Math.min(2, Math.floor(((teraz.getUTCDay() + 6) % 7) / 2))
  return { branza: BRANZE[nr % BRANZE.length], kat: KATY[(nr * 3 + 1) % KATY.length], nr }
}

async function ostatniePosty(pageId: string, token: string): Promise<string[]> {
  try {
    const r = await fetch(`${GRAPH}/${pageId}/posts?fields=message&limit=8&access_token=${encodeURIComponent(token)}`)
    if (!r.ok) return []
    const j = await r.json()
    return (j.data ?? []).map((p: { message?: string }) => p.message ?? '').filter(Boolean)
  } catch { return [] }
}

async function generujPost(branza: string, kat: string, poprzednie: string[]): Promise<{ tekst: string; haslo: string }> {
  const zapytanie = (thinking?: { type: string }) => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5-5',
      max_tokens: 8000,
      ...(thinking ? { thinking } : {}),
      system:
        'Jesteś copywriterem marki Skrojo.pl. Piszesz krótkie, zachęcające posty na Facebooka po polsku do właścicieli małych firm. ' +
        'Ton: konkretny, ciepły, bez żargonu i bez przesady. 400–700 znaków, 1–3 emoji, bez hashtagów-spamu (maks. 3 na końcu). ' +
        'Zakończ wezwaniem do wejścia na stronę lub wypróbowania demo; sam link dołącza system, więc NIE wklejaj adresu URL w treści. ' +
        'Używaj WYŁĄCZNIE faktów z listy. Nie zmyślaj funkcji, liczb, opinii klientów ani nazw klientów. Nie wspominaj o paliwach ani gazie. ' +
        'Dodatkowo wymyśl krótkie hasło na grafikę do posta: mocne, zrozumiałe, do 60 znaków, bez emoji, bez kropki na końcu. ' +
        'Zwróć WYŁĄCZNIE obiekt JSON w postaci {"post":"treść posta","haslo":"hasło na grafikę"}, bez komentarzy i bez bloku kodu.\n\nFAKTY:\n' + FAKTY,
      messages: [{
        role: 'user',
        content:
          `Napisz post dla grupy: ${branza}.\nKąt: ${kat}.\n` +
          (poprzednie.length ? `Nie powtarzaj stylu ani otwarcia tych ostatnich postów:\n${poprzednie.map(p => '- ' + p.slice(0, 160)).join('\n')}` : ''),
      }],
    }),
  })
  // Model bywa wrażliwy na parametr "thinking": próbujemy wariantów, aż któryś przejdzie
  let res = await zapytanie({ type: 'between_tools' })
  if (res.status === 400) res = await zapytanie({ type: 'disabled' })
  if (res.status === 400) res = await zapytanie()
  if (!res.ok) throw new Error('Claude: ' + (await res.text()).slice(0, 200))
  const j = await res.json()
  const surowy: string = ((j.content ?? []) as { type: string; text?: string }[])
    .filter(b => b.type === 'text').map(b => b.text ?? '').join('\n').trim()

  let tekst = surowy
  let haslo = 'CRM szyty na miarę Twojej firmy'
  try {
    const m = surowy.match(/\{[\s\S]*\}/)
    const o = JSON.parse(m ? m[0] : surowy)
    if (typeof o.post === 'string') tekst = o.post.trim()
    if (typeof o.haslo === 'string' && o.haslo.trim()) haslo = o.haslo.trim()
  } catch { /* model nie zwrócił JSON: używamy surowego tekstu i hasła domyślnego */ }
  haslo = haslo.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim().slice(0, 100) || 'CRM szyty na miarę Twojej firmy'

  if (tekst.length < 80 || tekst.length > 1500) {
    throw new Error(`Nieprawidłowa długość tekstu (${tekst.length}), stop: ${j.stop_reason}, podgląd: ${JSON.stringify(j).slice(0, 300)}`)
  }
  return { tekst, haslo }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pageId = process.env.FB_PAGE_ID
  const token = process.env.FB_PAGE_TOKEN
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  if (!dry && (!pageId || !token)) {
    return NextResponse.json({ error: 'Brak FB_PAGE_ID lub FB_PAGE_TOKEN' }, { status: 500 })
  }

  try {
    const teraz = new Date()
    const { branza, kat, nr } = wybierz(teraz)
    const poprzednie = pageId && token ? await ostatniePosty(pageId, token) : []
    const { tekst, haslo } = await generujPost(branza.nazwa, kat, poprzednie)

    const link =
      `${SITE}/branze/${branza.slug}.html?utm_source=facebook&utm_medium=organic` +
      `&utm_campaign=agent-${teraz.toISOString().slice(0, 7)}&utm_content=${branza.slug}-${nr}`

    // Grafika (PNG) z hasłem w barwach marki; post ze zdjęciem nie ma podglądu linku, więc link dopisujemy do treści
    const etykieta = ETYKIETY[branza.slug] ?? ''
    const grafika =
      `${APP}/api/agent/facebook/grafika?t=${encodeURIComponent(haslo)}&b=${encodeURIComponent(etykieta)}` +
      `&sig=${podpisGrafiki(haslo.slice(0, 110), etykieta)}`
    const wiadomosc = `${tekst}\n\n👉 ${link}`

    if (dry) return NextResponse.json({ dry: true, tekst, link, haslo, grafika, wiadomosc })

    const publikuj = process.env.FB_AUTOPUBLISH === 'true'
    const body = new URLSearchParams({ message: tekst, link, published: String(publikuj), access_token: token! })
    const r = await fetch(`${GRAPH}/${pageId}/feed`, { method: 'POST', body })
    const j = await r.json()
    if (!r.ok) return NextResponse.json({ error: 'Facebook', szczegoly: j?.error?.message ?? j }, { status: 502 })

    return NextResponse.json({ ok: true, id: j.id, opublikowano: publikuj, branza: branza.slug, kat })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Błąd' }, { status: 500 })
  }
}
