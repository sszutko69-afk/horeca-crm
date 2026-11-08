'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

type Wiadomosc = { rola: 'user' | 'assistant'; tresc: string }

type DaneFinansowe = {
  sprzedaz_brutto: number
  zakupy_brutto: number
  marza_brutto: number
  marza_transport: number
  liczba_transakcji: number
  liczba_klientow: number
  liczba_zakupow: number
  top_klienci: Array<{ nazwa: string; wartosc: number }>
  infakt_przychod: number
  infakt_koszty: number
  infakt_faktury: number
  infakt_dostepne: boolean
}

export default function AIPage() {
  const supabase = createClient()
  const [wiadomosci, setWiadomosci] = useState<Wiadomosc[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingDane, setLoadingDane] = useState(false)
  const [dane, setDane] = useState<DaneFinansowe | null>(null)
  const [error, setError] = useState('')

  function fmt(n: number) {
    return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  async function pobierzDane() {
    setLoadingDane(true)
    setError('')
    try {
      const VAT = 0.23

      // Dane z bazy GazCRM
      const [{ data: sprzedaz }, { data: zakupy }, { data: klienci }] = await Promise.all([
        supabase.from('sprzedaz').select('ilosc_litry, cena_sprzedazy, klient_id, nr_edd, klienci(nazwa)'),
        supabase.from('zakupy').select('ilosc_kg, cena_jednostkowa, nr_edd'),
        supabase.from('klienci').select('id').eq('aktywny', true),
      ])

      const sprzedazBrutto = (sprzedaz ?? []).reduce((a: number, s: any) => a + s.ilosc_litry * s.cena_sprzedazy, 0)

      const eddLitry: Record<string, number> = {}
      ;(sprzedaz ?? []).forEach((s: any) => {
        eddLitry[s.nr_edd] = (eddLitry[s.nr_edd] ?? 0) + s.ilosc_litry
      })

      let zakupBrutto = 0
      let marzaBrutto = 0
      ;(sprzedaz ?? []).forEach((s: any) => {
        const z = (zakupy ?? []).find((x: any) => x.nr_edd === s.nr_edd)
        if (!z || !eddLitry[s.nr_edd]) return
        const wsp = z.ilosc_kg / eddLitry[s.nr_edd]
        const koszt = s.ilosc_litry * z.cena_jednostkowa * wsp * (1 + VAT)
        zakupBrutto += koszt
        marzaBrutto += s.ilosc_litry * s.cena_sprzedazy - koszt
      })

      const klMap: Record<string, number> = {}
      ;(sprzedaz ?? []).forEach((s: any) => {
        const nazwa = s.klienci?.nazwa ?? s.klient_id
        klMap[nazwa] = (klMap[nazwa] ?? 0) + s.ilosc_litry * s.cena_sprzedazy
      })
      const topKlienci = Object.entries(klMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([nazwa, wartosc]) => ({ nazwa, wartosc }))

      // Dane z inFakt (opcjonalne)
      let infaktPrzychod = 0
      let infaktKoszty = 0
      let infaktFaktury = 0
      let infaktDostepne = false

      try {
        const infaktRes = await fetch('/api/infakt/sync')
        if (infaktRes.ok) {
          const infaktData = await infaktRes.json()
          if (infaktData.summary) {
            infaktPrzychod = infaktData.summary.przychod_brutto / 100
            infaktKoszty = infaktData.summary.koszty_brutto / 100
            infaktFaktury = infaktData.summary.faktur
            infaktDostepne = true
          }
        }
      } catch {}

      const d: DaneFinansowe = {
        sprzedaz_brutto: sprzedazBrutto,
        zakupy_brutto: zakupBrutto,
        marza_brutto: marzaBrutto,
        marza_transport: marzaBrutto / 2,
        liczba_transakcji: (sprzedaz ?? []).length,
        liczba_klientow: (klienci ?? []).length,
        liczba_zakupow: (zakupy ?? []).length,
        top_klienci: topKlienci,
        infakt_przychod: infaktPrzychod,
        infakt_koszty: infaktKoszty,
        infakt_faktury: infaktFaktury,
        infakt_dostepne: infaktDostepne,
      }
      setDane(d)
      setWiadomosci([])
      await zapytajAI(d, [], 'Przeanalizuj dane finansowe mojej firmy gazowej i podaj kluczowe obserwacje oraz 3-5 konkretnych sugestii jak poprawić rentowność.')
    } catch (e: any) {
      setError('Błąd pobierania danych: ' + e.message)
    }
    setLoadingDane(false)
  }

  function budujKontekst(d: DaneFinansowe) {
    const marżaPct = d.sprzedaz_brutto > 0 ? (d.marza_brutto / d.sprzedaz_brutto * 100).toFixed(1) : '0'
    let kontekst = `Jesteś doradcą finansowym dla firmy zajmującej się sprzedażą gazu grzewczego LPG.

DANE Z SYSTEMU GazCRM:
- Przychód ze sprzedaży gazu (brutto): ${fmt(d.sprzedaz_brutto)} zł
- Koszt zakupów gazu (brutto): ${fmt(d.zakupy_brutto)} zł
- Marża brutto: ${fmt(d.marza_brutto)} zł (${marżaPct}% przychodów)
- Marża na transporcie: ${fmt(d.marza_transport)} zł (marża / 2)
- Liczba transakcji sprzedaży: ${d.liczba_transakcji}
- Liczba aktywnych klientów: ${d.liczba_klientow}
- Liczba partii zakupowych (EDD): ${d.liczba_zakupow}
- Top 5 klientów: ${d.top_klienci.map(k => `${k.nazwa} (${fmt(k.wartosc)} zł)`).join(', ')}`

    if (d.infakt_dostepne) {
      kontekst += `

DANE Z INFAKT (księgowość):
- Przychód wg faktur inFakt: ${fmt(d.infakt_przychod)} zł (${d.infakt_faktury} faktur)
- Koszty wg inFakt: ${fmt(d.infakt_koszty)} zł
- Wynik brutto (inFakt): ${fmt(d.infakt_przychod - d.infakt_koszty)} zł`
    }

    kontekst += `

Odpowiadaj po polsku, konkretnie i praktycznie. Używaj liczb z danych. Formatuj odpowiedzi czytelnie używając punktorów gdy to pomaga.`

    return kontekst
  }

  async function zapytajAI(d: DaneFinansowe, poprzednieWiadomosci: Wiadomosc[], pytanie: string) {
    setLoading(true)
    const noweWiadomosci: Wiadomosc[] = [...poprzednieWiadomosci, { rola: 'user', tresc: pytanie }]
    setWiadomosci(noweWiadomosci)
    setInput('')

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kontekst: budujKontekst(d),
          messages: noweWiadomosci.map(w => ({
            role: w.rola === 'user' ? 'user' : 'assistant',
            content: w.tresc,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Błąd AI')
      const odpowiedz = data.odpowiedz ?? 'Brak odpowiedzi.'
      setWiadomosci([...noweWiadomosci, { rola: 'assistant', tresc: odpowiedz }])
    } catch (e: any) {
      setWiadomosci([...noweWiadomosci, { rola: 'assistant', tresc: '⚠ Błąd: ' + e.message }])
    }
    setLoading(false)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !dane || loading) return
    await zapytajAI(dane, wiadomosci, input.trim())
  }

  const szybkiePytania = [
    'Jak zwiększyć marżę na sprzedaży gazu?',
    'Który klient generuje największy zysk?',
    'Jak obniżyć koszty zakupu gazu?',
    'Oceń rentowność firmy i podaj priorytety działań',
    'Jakie ryzyka finansowe widzisz w danych?',
    'Jak zoptymalizować trasy dostaw żeby obniżyć koszty?',
    'Porównaj przychody z inFakt z danymi sprzedaży',
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-gray-900">AI — Analiza finansowa</h1>
          <p className="text-sm text-gray-500 mt-0.5">Asystent analizuje dane GazCRM + inFakt</p>
        </div>
        <button onClick={pobierzDane} disabled={loadingDane || loading}
          className="text-sm bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700 transition-colors disabled:opacity-50">
          {loadingDane ? 'Ładowanie danych...' : dane ? '↻ Odśwież i analizuj' : 'Załaduj dane i uruchom AI'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-4">{error}</p>}

      {!dane && !loadingDane && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mb-6">
          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="1.8" strokeLinecap="round">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">Asystent AI gotowy</p>
          <p className="text-xs text-gray-500 mb-1">Pobiera dane z GazCRM (sprzedaż, zakupy, marże) oraz inFakt (faktury, koszty).</p>
          <p className="text-xs text-gray-400">Wymaga ustawienia <span className="font-mono bg-gray-100 px-1 rounded">ANTHROPIC_API_KEY</span> w <span className="font-mono bg-gray-100 px-1 rounded">.env.local</span></p>
        </div>
      )}

      {loadingDane && (
        <p className="text-sm text-gray-400 text-center py-8">Pobieranie danych z GazCRM i inFakt...</p>
      )}

      {/* KPI */}
      {dane && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
          {[
            { l: 'Przychód (GazCRM)', v: fmt(dane.sprzedaz_brutto) + ' zł' },
            { l: 'Marża brutto', v: fmt(dane.marza_brutto) + ' zł', s: dane.sprzedaz_brutto > 0 ? (dane.marza_brutto / dane.sprzedaz_brutto * 100).toFixed(1) + '%' : '' },
            { l: 'Marża transport', v: fmt(dane.marza_transport) + ' zł' },
            dane.infakt_dostepne
              ? { l: 'Koszty (inFakt)', v: fmt(dane.infakt_koszty) + ' zł', s: `${dane.infakt_faktury} faktur` }
              : { l: 'Klientów', v: String(dane.liczba_klientow), s: `${dane.liczba_transakcji} transakcji` },
          ].map(k => (
            <div key={k.l} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.l}</p>
              <p className="text-lg font-medium text-gray-900">{k.v}</p>
              {k.s && <p className="text-xs text-gray-400 mt-0.5">{k.s}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Źródła danych */}
      {dane && (
        <div className="flex gap-2 mb-4">
          <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg">✓ GazCRM</span>
          {dane.infakt_dostepne
            ? <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg">✓ inFakt</span>
            : <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200 px-2 py-1 rounded-lg">— inFakt (brak sync)</span>
          }
        </div>
      )}

      {/* Chat */}
      {wiadomosci.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl mb-4 overflow-hidden">
          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {wiadomosci.map((w, i) => (
              <div key={i} className={`flex gap-3 ${w.rola === 'user' ? 'justify-end' : 'justify-start'}`}>
                {w.rola === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round">
                      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  w.rola === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-50 border border-gray-200 text-gray-800'
                }`}>
                  {w.tresc}
                </div>
                {w.rola === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>
                  </svg>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Szybkie pytania */}
      {dane && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Szybkie pytania</p>
          <div className="flex flex-wrap gap-2">
            {szybkiePytania.map(p => (
              <button key={p} onClick={() => zapytajAI(dane!, wiadomosci, p)}
                disabled={loading}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50">
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      {dane && (
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Zadaj pytanie o finanse firmy..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button type="submit" disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
            Wyślij
          </button>
        </form>
      )}

      {wiadomosci.length > 0 && (
        <div className="flex justify-end mt-3">
          <button onClick={() => setWiadomosci([])}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Wyczyść rozmowę
          </button>
        </div>
      )}
    </div>
  )
}
