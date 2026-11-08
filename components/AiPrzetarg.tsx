'use client'

import { useState, useRef, useEffect } from 'react'

type Przetarg = {
  id: string; tytul: string; zamawiajacy: string | null
  cpv_kod: string | null; wartosc_netto: number | null
  data_skladania: string; branza: string | null
  url_postepowania: string | null; uwagi: string | null
  zrodlo: string | null
}

const SZABLONY = [
  {
    id: 'analiza', label: '🔍 Analiza przetargu',
    prompt: 'Przeanalizuj ten przetarg z perspektywy firmy gazowej ON Gaz (ongaz.pl). Oceń: 1) czy warto skladac oferte, 2) wymagania techniczne i formalne, 3) potrzebne dokumenty, 4) szacowany naklad pracy i marza, 5) glowne ryzyka. Odpowiedz konkretnie po polsku.',
  },
  {
    id: 'wycena', label: '💰 Wycena szacunkowa',
    prompt: 'Przygotuj szczegolowa wycene szacunkowa dla tego przetargu. Uwzglednij: 1) Zestawienie robocizny (KNR/KNNR) - godziny i stawki, 2) Materialy - ilosci i ceny rynkowe, 3) Sprzet i transport, 4) Koszty posrednie i zysk, 5) Laczna cena netto i brutto. Opieraj sie na aktualnych cenach rynkowych dla branzy gazowniczej i budowlanej.',
  },
  {
    id: 'oferta', label: '📝 Projekt oferty',
    prompt: 'Na podstawie opisu przetargu i zalaczonej dokumentacji przygotuj szkic oferty dla firmy ON Gaz sp. z o.o. Uwzglednij: 1) strone tytulowa, 2) formularz cenowy, 3) oswiadczenie o spelnieniu warunkow, 4) wykaz doswiadczenia w podobnych realizacjach, 5) proponowane podejscie techniczne.',
  },
  {
    id: 'checklist', label: '✅ Lista dokumentów',
    prompt: 'Sporzadz kompletna liste kontrolna dokumentow do zlozenia oferty: dokumenty obowiazkowe, oswiadczenia, dokumenty techniczne, referencje i doswiadczenie, dokumenty finansowe. Dla kazdej pozycji podaj: kto wystawia, waznosc, wymagany format.',
  },
  {
    id: 'pytania', label: '❓ Pytania do SWZ',
    prompt: 'Przygotuj liste pytan do zamawiajacego dotyczacych SWZ, ktore zwieksza szanse ON Gaz na wygrana. Skup sie na: niejasnych wymaganiach technicznych, warunkach udzialu, kryteriach oceny, mozliwosci zmiany umowy, kwestiach platnosci.',
  },
  {
    id: 'swz_analiza', label: '📋 Analiza SWZ',
    prompt: 'Przeprowadz szczegolowa analize SWZ pod katem ryzyk dla wykonawcy. Zwroc uwage na: kryteria oceny ofert, warunki udzialu, kary umowne i ich wysokosc, waloryzacje cen, terminy platnosci, gwarancje i rekojmie, potencjalne pulapki. Ocen ryzyko: niskie/srednie/wysokie.',
  },
]

// Parsuj entry "nazwa||url" → {name, url}
function parseDoc(entry: string): { name: string; url: string } {
  const sep = entry.indexOf('||')
  if (sep < 0) return { name: entry, url: entry }
  return { name: entry.substring(0, sep), url: entry.substring(sep + 2) }
}

// Pobierz treść pliku przez API route (server-side, omija CORS)
async function fetchDocContent(url: string, name: string): Promise<{ type: 'text' | 'pdf' | 'skip'; content: string }> {
  try {
    const res = await fetch('/api/przetargi/doc-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, name }),
    })
    const json = await res.json()
    if (json.type === 'skip' || !json.content) return { type: 'skip', content: '' }
    return { type: json.type, content: json.content }
  } catch (e) {
    console.warn('[fetchDoc] Błąd:', name, e)
    return { type: 'skip', content: '' }
  }
}

export default function AiPrzetarg({ przetarg, dokumenty }: { przetarg: Przetarg; dokumenty: string[] }) {
  const [zapytanie, setZapytanie] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [historia, setHistoria] = useState<Array<{ rola: string; tresc: string }>>([])
  const [docStatus, setDocStatus] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [generujDOCX, setGenerujDOCX] = useState<string | null>(null) // klucz generowanego dokumentu
  const [loadedDocs, setLoadedDocs] = useState<Array<{ name: string; type: string; content: string }>>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Zapamiętaj aktualną listę dokumentów jako ref
  const dokumentyRef = useRef<string[]>(dokumenty)
  const prevKeyRef = useRef<string>('')

  // Załaduj dokumenty gdy lista się zmienia - używaj ref żeby uniknąć stale closure
  useEffect(() => {
    dokumentyRef.current = dokumenty
    const key = dokumenty.slice().sort().join('|')
    if (key === prevKeyRef.current) return  // nic się nie zmieniło
    prevKeyRef.current = key
    loadDocuments(dokumenty)
  })  // bez dependency array - sprawdzaj przy każdym renderze, ale guard przez prevKeyRef

  async function loadDocuments(lista: string[]) {
    if (lista.length === 0) {
      setLoadedDocs([])
      setDocStatus('ready')
      return
    }
    setDocStatus('loading')
    const loaded: Array<{ name: string; type: string; content: string }> = []
    console.log('[AiPrzetarg] Ładuję', lista.length, 'dokumentów:', lista.map(e => parseDoc(e).name))

    for (const entry of lista) {
      const { name, url } = parseDoc(entry)
      if (!url.startsWith('http')) {
        console.log('[AiPrzetarg] Pomijam (brak URL):', name)
        continue
      }
      const result = await fetchDocContent(url, name)
      console.log('[AiPrzetarg]', name, '->', result.type, result.content.length, 'znaków')
      if (result.type !== 'skip' && result.content) {
        loaded.push({ name, type: result.type, content: result.content })
      }
    }

    console.log('[AiPrzetarg] Załadowano', loaded.length, '/', lista.length, 'dokumentów')
    setLoadedDocs(loaded)
    setDocStatus('ready')
  }

  // Zbuduj kontekst przetargu + treść dokumentów
  function buildSystemPrompt(): string {
    const info = [
      `Przetarg: ${przetarg.tytul}`,
      `Zamawiający: ${przetarg.zamawiajacy ?? 'nieznany'}`,
      `Branża: ${przetarg.branza ?? 'ogólna'}`,
      `CPV: ${przetarg.cpv_kod ?? 'brak'}`,
      `Wartość netto: ${przetarg.wartosc_netto ? przetarg.wartosc_netto.toLocaleString('pl-PL') + ' PLN' : 'nieznana'}`,
      `Termin składania: ${przetarg.data_skladania}`,
      `Link do postępowania: ${przetarg.url_postepowania ?? 'brak'}`,
      `Źródło: ${przetarg.zrodlo ?? 'bzp'}`,
      przetarg.uwagi ? `Notatki: ${przetarg.uwagi.substring(0, 500)}` : '',
    ].filter(Boolean).join('\n')

    let docsSection = ''
    if (loadedDocs.length > 0) {
      const docsList = loadedDocs.map(d => {
        if (d.type === 'text') {
          return `\n--- DOKUMENT: ${d.name} ---\n${d.content}\n--- KONIEC DOKUMENTU ---`
        }
        return `\n--- DOKUMENT PDF: ${d.name} (treść w załączniku) ---`
      }).join('\n')
      docsSection = `\n\nDOKUMENTACJA PRZETARGOWA (${loadedDocs.length} pliki):\n${docsList}`
    } else if (dokumenty.length > 0) {
      docsSection = `\nZałączone pliki (brak możliwości odczytu): ${dokumenty.map(d => parseDoc(d).name).join(', ')}`
    }

    return `Jesteś asystentem przetargowym firmy ON Gaz (ongaz.pl) — firma zajmuje się dystrybucją gazu LPG i robotami budowlanymi związanymi z gazownictwem. Pomagasz analizować przetargi i przygotowywać dokumentację przetargową. Odpowiadaj po polsku, konkretnie i profesjonalnie.\n\nKONTEKST PRZETARGU:\n${info}${docsSection}`
  }

  // Zbuduj wiadomości — dla PDF-ów użyj document content blocks
  function buildMessages(prompt: string): any[] {
    const pdfDocs = loadedDocs.filter(d => d.type === 'pdf')

    if (pdfDocs.length === 0) {
      // Brak PDF — zwykłe wiadomości tekstowe
      return [
        ...historia.map(h => ({ role: h.rola, content: h.tresc })),
        { role: 'user', content: prompt },
      ]
    }

    // PDF — użyj document content blocks w pierwszej wiadomości
    const pdfBlocks = pdfDocs.map(d => ({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: d.content,
      },
      title: d.name,
    }))

    const firstUserMsg = {
      role: 'user',
      content: [
        ...pdfBlocks,
        { type: 'text', text: prompt },
      ],
    }

    if (historia.length === 0) {
      return [firstUserMsg]
    }

    return [
      ...historia.map(h => ({ role: h.rola, content: h.tresc })),
      { role: 'user', content: prompt },
    ]
  }

  async function zapytajAI(prompt: string) {
    if (!prompt.trim()) return
    setLoading(true); setError('')

    try {
      const res = await fetch('/api/anthropic/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: buildSystemPrompt(),
          messages: buildMessages(prompt),
          maxTokens: 3000,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Błąd AI')

      const tresc = json.content
      setHistoria(prev => [
        { rola: 'assistant', tresc },
        { rola: 'user', tresc: prompt },
        ...prev,
      ])
      setZapytanie('')
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  const docsReady = docStatus === 'ready'

  // Generuj dokument DOCX przez AI
  async function generateDocx(typ: string, label: string) {
    setGenerujDOCX(typ)
    try {
      // Zbierz treść dokumentów tekstowych do kontekstu
      const dokumentyTresc = loadedDocs
        .filter(d => d.type === 'text')
        .map(d => `=== ${d.name} ===\n${d.content}`)
        .join('\n\n')

      const res = await fetch('/api/przetargi/generuj-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typ, przetarg, dokumentyTresc }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }

      // Pobierz plik DOCX
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${typ}_${przetarg.tytul.substring(0, 40).replace(/[^a-zA-Z0-9]/g, '_')}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(`Błąd generowania: ${e.message}`)
    }
    setGenerujDOCX(null)
  }
  const hasDocs = loadedDocs.length > 0

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Status dokumentów */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${hasDocs ? 'bg-green-50 border-green-200' : docStatus === 'loading' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
        {docStatus === 'loading' && (
          <div className="flex items-center gap-2 text-blue-700">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-xs">Ładowanie dokumentów przetargowych...</span>
          </div>
        )}
        {docStatus === 'ready' && hasDocs && (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-green-700">
              <span className="text-base">✅</span>
              <span className="text-xs font-medium">
                AI widzi {loadedDocs.length} dokument(y): {loadedDocs.map(d => d.name).join(', ')}
              </span>
            </div>
            <button onClick={() => loadDocuments(dokumentyRef.current)} className="text-xs text-green-600 hover:underline flex-shrink-0 ml-2">
              Odśwież
            </button>
          </div>
        )}
        {docStatus === 'ready' && !hasDocs && dokumenty.length > 0 && (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-orange-700">
              <span className="text-base">⚠️</span>
              <span className="text-xs">
                Nie udało się odczytać dokumentów ({dokumenty.length} pliki — tylko PDF i TXT są obsługiwane).
                AI zna nazwy plików.
              </span>
            </div>
            <button onClick={() => loadDocuments(dokumentyRef.current)} className="text-xs text-orange-600 hover:underline flex-shrink-0 ml-2">
              Spróbuj ponownie
            </button>
          </div>
        )}
        {docStatus === 'idle' && dokumenty.length === 0 && (
          <div className="flex items-center gap-2 text-gray-500">
            <span className="text-base">ℹ️</span>
            <span className="text-xs">Brak załączonych dokumentów. Dodaj SWZ lub OPZ w zakładce Dokumenty — AI przeczyta ich treść.</span>
          </div>
        )}
      </div>

      {/* Szybkie akcje */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Szybkie akcje</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {SZABLONY.map(s => (
            <button key={s.id} onClick={() => zapytajAI(s.prompt)} disabled={loading || docStatus === 'loading'}
              className="text-left p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs hover:bg-blue-50 hover:border-blue-200 transition-colors disabled:opacity-50">
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generuj dokumenty DOCX */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">📄 Generuj dokumenty DOCX</p>
          <a href="/ustawienia" target="_blank" className="text-xs text-blue-600 hover:underline">
            ⚙ Dane firmy →
          </a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { typ: 'oferta',                   label: '📋 Formularz ofertowy' },
            { typ: 'kosztorys',                label: '💰 Kosztorys ofertowy' },
            { typ: 'oswiadczenie_warunkow',    label: '✅ Ośw. warunki' },
            { typ: 'oswiadczenie_wykluczenia', label: '✅ Ośw. wykluczenie' },
            { typ: 'wykaz_robot',              label: '🔨 Wykaz robót' },
            { typ: 'wykaz_osob',               label: '👤 Wykaz osób' },
            { typ: 'pelnomocnictwo',           label: '📜 Pełnomocnictwo' },
            { typ: 'zobowiazanie',             label: '🤝 Zobowiązanie' },
          ].map(doc => (
            <button key={doc.typ}
              onClick={() => generateDocx(doc.typ, doc.label)}
              disabled={!!generujDOCX || docStatus === 'loading'}
              className="flex items-center gap-1.5 text-left p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs hover:bg-emerald-100 transition-colors disabled:opacity-50 whitespace-nowrap overflow-hidden">
              {generujDOCX === doc.typ
                ? <span className="flex items-center gap-1"><div className="w-3 h-3 border border-emerald-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />Generuję...</span>
                : <span className="truncate">{doc.label}</span>
              }
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          AI generuje dokument używając danych firmy z <a href="/ustawienia" target="_blank" className="text-blue-500 hover:underline">Ustawień</a> i dokumentacji przetargowej.
          {!hasDocs && ' Dodaj SWZ w zakładce Dokumenty dla pełniejszej treści.'}
        </p>
      </div>

      {/* Historia — nowe na górze */}
      {historia.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rozmowa</p>
            <button onClick={() => setHistoria([])} className="text-xs text-red-400 hover:text-red-600">
              Wyczyść
            </button>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {historia.map((h, i) => (
              <div key={i} className={`rounded-xl p-3 ${h.rola === 'user'
                ? 'bg-blue-50 border border-blue-100 text-blue-900'
                : 'bg-white border border-gray-200 text-gray-800'}`}>
                <p className="text-xs font-semibold mb-1.5 opacity-60">
                  {h.rola === 'user' ? '👤 Twoje zapytanie' : '🤖 Odpowiedź AI'}
                </p>
                <div className="whitespace-pre-wrap text-xs leading-relaxed">{h.tresc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm text-gray-500">AI analizuje{hasDocs ? ' dokumenty i' : ''} przetarg...</span>
        </div>
      )}

      {/* Błąd */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-xs text-red-600">⚠ {error}</p>
        </div>
      )}

      {/* Własne zapytanie */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Własne zapytanie</p>
        <textarea ref={textareaRef} value={zapytanie} onChange={e => setZapytanie(e.target.value)}
          placeholder={hasDocs
            ? `Zapytaj AI o treść dokumentów... np. "Jaki jest zakres robót z OPZ?" lub "Ile wynosi wadium?"`
            : `Zapytaj AI o ten przetarg... np. "Jakie doświadczenie referencyjne powinienem mieć?"`}
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) zapytajAI(zapytanie) }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">Ctrl+Enter aby wysłać</span>
          <button onClick={() => zapytajAI(zapytanie)} disabled={!zapytanie.trim() || loading || docStatus === 'loading'}
            className="text-sm bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-40 font-medium">
            {loading ? '⏳' : '🤖 Zapytaj AI'}
          </button>
        </div>
      </div>
    </div>
  )
}
