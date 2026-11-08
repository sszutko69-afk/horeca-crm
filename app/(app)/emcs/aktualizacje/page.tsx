'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

const supabase = createClient()

const KODY_CN_DEFAULT = [
  { v: '27111900', e: 'E500', l: '27111900 — E500 — LPG (propan-butan skroplony) ★' },
  { v: '27111200', e: 'E500', l: '27111200 — E500 — Propan skroplony LPG' },
  { v: '27111300', e: 'E500', l: '27111300 — E500 — Butan skroplony LPG' },
  { v: '27111100', e: 'E500', l: '27111100 — E500 — Gaz ziemny skroplony (LNG)' },
  { v: '27112100', e: 'E500', l: '27112100 — E500 — Gaz ziemny w stanie gazowym (CNG)' },
  { v: '27102000', e: 'E600', l: '27102000 — E600 — Oleje napędowe (diesel)' },
  { v: '27101290', e: 'E200', l: '27101290 — E200 — Benzyna silnikowa' },
]

const TRANSPORT_DEFAULT = [
  { v: '1', l: '1 — Transport morski' },
  { v: '2', l: '2 — Transport kolejowy' },
  { v: '3', l: '3 — Transport drogowy' },
  { v: '4', l: '4 — Transport lotniczy' },
  { v: '5', l: '5 — Przesyłka pocztowa' },
  { v: '6', l: '6 — Stałe instalacje przesyłowe (rurociąg)' },
  { v: '7', l: '7 — Transport śródlądowy' },
]

const OPAKOWANIA_DEFAULT = [
  { v: 'TK', l: 'TK — Cysterna (zbiornik)' },
  { v: 'TY', l: 'TY — Cysterna cylindryczna' },
  { v: 'VL', l: 'VL — Luzem (ciecz)' },
  { v: 'VQ', l: 'VQ — Luzem (gaz)' },
]

type TabAkt = 'wersja' | 'kody-cn' | 'transport' | 'opakowania' | 'historia'

const inp = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
const btnPrimary = "px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
const btnGray = "px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"

export default function EmcsAktualizacjePage() {
  const [tab, setTab] = useState<TabAkt>('wersja')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')

  // Dane wersji
  const [nsVersion, setNsVersion] = useState('2025/03')
  const [nsVersionInput, setNsVersionInput] = useState('2025/03')
  const [ostatnieSprawdzenie, setOstatnieSprawdzenie] = useState('')
  const [monitoringAktywny, setMonitoringAktywny] = useState(true)
  const [sprawdzanie, setSprawdzanie] = useState(false)
  const [wynikSprawdzenia, setWynikSprawdzenia] = useState<any>(null)

  // Historia wersji
  const [historiaWersji, setHistoriaWersji] = useState<{ wersja: string; data: string; zmiana: string }[]>([])

  // Listy kodów (JSON editable)
  const [kodyCN, setKodyCN] = useState(JSON.stringify(KODY_CN_DEFAULT, null, 2))
  const [kodyTransport, setKodyTransport] = useState(JSON.stringify(TRANSPORT_DEFAULT, null, 2))
  const [kodyOpakowania, setKodyOpakowania] = useState(JSON.stringify(OPAKOWANIA_DEFAULT, null, 2))

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('firma_dane')
      .select('klucz, wartosc')
      .in('klucz', [
        'emcs_ns_wersja', 'emcs_ostatnie_sprawdzenie', 'emcs_monitoring_aktywny',
        'emcs_kody_cn', 'emcs_kody_transport', 'emcs_kody_opakowania', 'emcs_historia_wersji',
      ])
    if (data) {
      const cfg = Object.fromEntries(data.map(r => [r.klucz, r.wartosc]))
      const ver = cfg.emcs_ns_wersja || '2025/03'
      setNsVersion(ver)
      setNsVersionInput(ver)
      setOstatnieSprawdzenie(cfg.emcs_ostatnie_sprawdzenie || '')
      setMonitoringAktywny(cfg.emcs_monitoring_aktywny !== 'false')
      if (cfg.emcs_kody_cn) try { setKodyCN(JSON.stringify(JSON.parse(cfg.emcs_kody_cn), null, 2)) } catch {}
      if (cfg.emcs_kody_transport) try { setKodyTransport(JSON.stringify(JSON.parse(cfg.emcs_kody_transport), null, 2)) } catch {}
      if (cfg.emcs_kody_opakowania) try { setKodyOpakowania(JSON.stringify(JSON.parse(cfg.emcs_kody_opakowania), null, 2)) } catch {}
      if (cfg.emcs_historia_wersji) try { setHistoriaWersji(JSON.parse(cfg.emcs_historia_wersji)) } catch {}
    }
    setLoading(false)
  }

  async function zapiszWersje() {
    const v = nsVersionInput.trim()
    if (!/^\d{4}\/\d{2}$/.test(v)) {
      setError('Format: RRRR/MM np. 2025/03 lub 2025/09')
      return
    }
    setSaving(true); setError(''); setInfo('')
    // Dodaj do historii
    const nowaHistoria = [
      { wersja: v, data: new Date().toISOString(), zmiana: nsVersion !== v ? `Zmiana z ${nsVersion} na ${v}` : 'Potwierdzenie bieżącej wersji' },
      ...historiaWersji.slice(0, 19),
    ]
    await supabase.from('firma_dane').upsert([
      { klucz: 'emcs_ns_wersja', wartosc: v },
      { klucz: 'emcs_historia_wersji', wartosc: JSON.stringify(nowaHistoria) },
    ], { onConflict: 'klucz' })
    setNsVersion(v)
    setHistoriaWersji(nowaHistoria)
    setInfo(`✅ Wersja XSD zaktualizowana do ${v}. Moduł EMCS używa nowych namespace'ów od następnego przeładowania strony.`)
    setSaving(false)
  }

  async function zapiszMonitoring() {
    setSaving(true)
    await supabase.from('firma_dane').upsert(
      { klucz: 'emcs_monitoring_aktywny', wartosc: String(monitoringAktywny) },
      { onConflict: 'klucz' }
    )
    setInfo('✅ Ustawienia monitoringu zapisane.')
    setSaving(false)
  }

  async function sprawdzTeraz() {
    setSprawdzanie(true); setError(''); setWynikSprawdzenia(null)
    try {
      const res = await fetch('/api/emcs/sprawdz-aktualizacje?manual=1')
      const json = await res.json()
      setWynikSprawdzenia(json)
      setOstatnieSprawdzenie(json.sprawdzono || '')
    } catch (e: any) {
      setError('Błąd sprawdzenia: ' + e.message)
    }
    setSprawdzanie(false)
  }

  async function zapiszListeKodow(klucz: string, json: string) {
    try {
      JSON.parse(json) // walidacja
    } catch {
      setError('Nieprawidłowy JSON. Sprawdź składnię.')
      return
    }
    setSaving(true); setError('')
    await supabase.from('firma_dane').upsert({ klucz, wartosc: json }, { onConflict: 'klucz' })
    setInfo(`✅ Lista ${klucz} zapisana. Przeładuj moduł EMCS aby zobaczyć zmiany.`)
    setSaving(false)
  }

  const tabs: { id: TabAkt; label: string }[] = [
    { id: 'wersja', label: '📋 Wersja XSD' },
    { id: 'kody-cn', label: '🏷 Kody CN' },
    { id: 'transport', label: '🚛 Transport' },
    { id: 'opakowania', label: '📦 Opakowania' },
    { id: 'historia', label: '🕐 Historia' },
  ]

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Ładowanie...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">

        {/* Nagłówek */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <a href="/emcs" className="text-sm text-blue-600 hover:underline">← EMCS PL 2</a>
              <span className="text-gray-300">/</span>
              <span className="text-sm text-gray-500">Aktualizacje schematów</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Aktualizacje EMCS PL 2</h1>
            <p className="text-sm text-gray-500 mt-0.5">Zarządzaj wersjami schematów XSD i listami kodów</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400 mb-1">Aktywna wersja XSD</div>
            <div className="bg-blue-900 text-white text-sm font-bold px-3 py-1.5 rounded-lg font-mono">{nsVersion}</div>
          </div>
        </div>

        {/* Alert info */}
        {info && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
            {info} <button onClick={() => setInfo('')} className="ml-2 text-green-600 hover:text-green-800">✕</button>
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
            {error} <button onClick={() => setError('')} className="ml-2 text-red-600 hover:text-red-800">✕</button>
          </div>
        )}

        {/* Taby */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── TAB: WERSJA XSD ─── */}
        {tab === 'wersja' && (
          <div className="space-y-4">

            {/* Aktualizacja wersji */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Wersja schematów XSD</h2>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5 text-sm text-amber-800">
                <p className="font-semibold mb-1">⚠️ Kiedy aktualizować?</p>
                <p>Ministerstwo Finansów / PUESC wydaje nowe wersje schematów EDD zazwyczaj kilka razy w roku.
                Zmiana wersji oznacza zmianę daty w namespace URL, np. z <code className="bg-amber-100 px-1 rounded">2025/03</code> na <code className="bg-amber-100 px-1 rounded">2025/09</code>.
                Dokumenty XML z nieaktualnym namespace będą odrzucane przez EMCS.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Aktualna wersja (używana)</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-700">{nsVersion}</div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Nowa wersja (format: RRRR/MM)</label>
                  <input
                    value={nsVersionInput}
                    onChange={e => setNsVersionInput(e.target.value)}
                    placeholder="np. 2025/09"
                    className={inp + ' font-mono'}
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-500 font-mono">
                <div className="text-gray-400 mb-1">Namespace po zmianie:</div>
                <div>http://www.mf.gov.pl/schematy/EDD/DD815B/<strong className="text-blue-700">{nsVersionInput || '??'}</strong>/</div>
              </div>

              <button onClick={zapiszWersje} disabled={saving || nsVersionInput === nsVersion} className={btnPrimary}>
                {saving ? 'Zapisywanie...' : '💾 Zastosuj nową wersję XSD'}
              </button>
              {nsVersionInput === nsVersion && (
                <span className="ml-3 text-xs text-gray-400">Brak zmian</span>
              )}
            </div>

            {/* Monitoring PUESC */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Monitoring PUESC</h2>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-700 font-medium">Automatyczne sprawdzanie</p>
                  <p className="text-xs text-gray-400 mt-0.5">Co poniedziałek 7:30 — sprawdza zmiany na stronie PUESC i wysyła email alert</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={monitoringAktywny}
                    onChange={e => setMonitoringAktywny(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-0.5">Ostatnie sprawdzenie</div>
                  <div className="text-sm font-medium text-gray-700">
                    {ostatnieSprawdzenie
                      ? new Date(ostatnieSprawdzenie).toLocaleString('pl-PL')
                      : 'Nie sprawdzano jeszcze'}
                  </div>
                </div>
                <button onClick={sprawdzTeraz} disabled={sprawdzanie} className={btnPrimary}>
                  {sprawdzanie ? '⏳ Sprawdzam...' : '🔍 Sprawdź teraz'}
                </button>
                <button onClick={zapiszMonitoring} disabled={saving} className={btnGray}>
                  Zapisz
                </button>
              </div>

              {wynikSprawdzenia && (
                <div className={`rounded-lg p-4 text-sm ${wynikSprawdzenia.zmiana ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                  <p className="font-semibold mb-2">
                    {wynikSprawdzenia.zmiana ? '⚠️ Wykryto zmiany na PUESC!' : '✅ Brak zmian — strona PUESC bez zmian'}
                  </p>
                  <div className="space-y-1 text-xs text-gray-600">
                    {(wynikSprawdzenia.wynikiFetch || []).map((w: any, i: number) => (
                      <div key={i}><span className="font-mono">{w.url.slice(0, 50)}...</span> → <span className={w.status === 'ok' ? 'text-green-700' : 'text-red-600'}>{w.status}</span></div>
                    ))}
                  </div>
                  {wynikSprawdzenia.emailWyslany && (
                    <p className="mt-2 text-xs text-blue-700">📧 Email alert wysłany</p>
                  )}
                </div>
              )}
            </div>

            {/* Źródła oficjalne */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Oficjalne źródła — sprawdź ręcznie</h2>
              <div className="space-y-2">
                {[
                  { label: '🏛 Portal PUESC (EMCS PL 2)', url: 'https://puesc.gov.pl/uslugi/e-commerce-1', desc: 'Schematy XSD, dokumentacja techniczna' },
                  { label: '📋 MF — EMCS PL 2', url: 'https://www.podatki.gov.pl/akcyza/akcyza-w-obrocie-wewnatrzunijnym-emcs-pl2/', desc: 'Przepisy, zmiany, komunikaty' },
                  { label: '⚖️ EUR-Lex — Dyrektywa akcyzowa', url: 'https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX%3A32020L0262', desc: 'Dyrektywa Rady (UE) 2020/262' },
                  { label: '📰 Dziennik Ustaw', url: 'https://isap.sejm.gov.pl/isap.nsf/search.xsp?type=3&keywords=akcyza', desc: 'Polskie akty prawne — ustawa akcyzowa' },
                ].map(s => (
                  <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors group">
                    <span className="text-sm font-medium text-blue-700 group-hover:underline flex-1">{s.label}</span>
                    <span className="text-xs text-gray-400">{s.desc}</span>
                    <span className="text-gray-300">↗</span>
                  </a>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ─── TAB: KODY CN ─── */}
        {tab === 'kody-cn' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Kody CN (Nomenklatura Scalona)</h2>
            <p className="text-xs text-gray-500 mb-4">
              Kody CN aktualizowane są corocznie przez Komisję Europejską (rozporządzenie TARIC). Zmiany wchodzą w życie 1 stycznia każdego roku.
              Sprawdź: <a href="https://ec.europa.eu/taxation_customs/dds2/taric/" target="_blank" className="text-blue-600 hover:underline">TARIC</a>
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-3">
              ⚠️ Zmiana listy kodów CN wymaga przeładowania strony EMCS. Format: tablica JSON <code>[{"{"}"v":"27111900","e":"E500","l":"opis"{"}"}, ...]</code>
            </div>
            <textarea
              value={kodyCN}
              onChange={e => setKodyCN(e.target.value)}
              rows={16}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              spellCheck={false}
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => zapiszListeKodow('emcs_kody_cn', kodyCN)} disabled={saving} className={btnPrimary}>
                {saving ? 'Zapisywanie...' : '💾 Zapisz kody CN'}
              </button>
              <button onClick={() => setKodyCN(JSON.stringify(KODY_CN_DEFAULT, null, 2))} className={btnGray}>
                ↩ Przywróć domyślne
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB: TRANSPORT ─── */}
        {tab === 'transport' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Kody trybu transportu</h2>
            <p className="text-xs text-gray-500 mb-4">
              TransportModeCode — kody zdefiniowane w dyrektywie (UE) 2020/262. Zmiany rzadkie.
              Format: tablica JSON <code>[{"{"}"v":"3","l":"opis"{"}"}, ...]</code>
            </p>
            <textarea
              value={kodyTransport}
              onChange={e => setKodyTransport(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              spellCheck={false}
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => zapiszListeKodow('emcs_kody_transport', kodyTransport)} disabled={saving} className={btnPrimary}>
                {saving ? 'Zapisywanie...' : '💾 Zapisz kody transportu'}
              </button>
              <button onClick={() => setKodyTransport(JSON.stringify(TRANSPORT_DEFAULT, null, 2))} className={btnGray}>
                ↩ Przywróć domyślne
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB: OPAKOWANIA ─── */}
        {tab === 'opakowania' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Kody rodzajów opakowań</h2>
            <p className="text-xs text-gray-500 mb-4">
              KindOfPackagesType — kody UN/CEFACT. Format: tablica JSON <code>[{"{"}"v":"TK","l":"opis"{"}"}, ...]</code>
            </p>
            <textarea
              value={kodyOpakowania}
              onChange={e => setKodyOpakowania(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              spellCheck={false}
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => zapiszListeKodow('emcs_kody_opakowania', kodyOpakowania)} disabled={saving} className={btnPrimary}>
                {saving ? 'Zapisywanie...' : '💾 Zapisz kody opakowań'}
              </button>
              <button onClick={() => setKodyOpakowania(JSON.stringify(OPAKOWANIA_DEFAULT, null, 2))} className={btnGray}>
                ↩ Przywróć domyślne
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB: HISTORIA ─── */}
        {tab === 'historia' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Historia aktualizacji wersji XSD</h2>
            {historiaWersji.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Brak historii — pojawi się po pierwszej zmianie wersji.</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-400 uppercase py-2 pr-4">Data</th>
                    <th className="text-left text-xs font-medium text-gray-400 uppercase py-2 pr-4">Wersja</th>
                    <th className="text-left text-xs font-medium text-gray-400 uppercase py-2">Opis zmiany</th>
                  </tr>
                </thead>
                <tbody>
                  {historiaWersji.map((h, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">{new Date(h.data).toLocaleString('pl-PL')}</td>
                      <td className="py-2 pr-4"><span className="font-mono bg-blue-50 text-blue-800 px-2 py-0.5 rounded text-xs">{h.wersja}</span></td>
                      <td className="py-2 text-gray-600 text-xs">{h.zmiana}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Instrukcja na dole */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-900">
          <h3 className="font-semibold mb-2">📌 Procedura aktualizacji EMCS — co robić gdy MF wyda nową wersję</h3>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Wejdź na <a href="https://puesc.gov.pl/uslugi/e-commerce-1" target="_blank" className="underline">portal PUESC</a> i sprawdź datę nowych schematów XSD</li>
            <li>Pobierz i sprawdź pliki XSD — porównaj strukturę z poprzednią wersją</li>
            <li>Zaktualizuj wersję w zakładce "Wersja XSD" powyżej (format RRRR/MM)</li>
            <li>Przetestuj wygenerowanie dokumentu DD815B — sprawdź czy namespace URL jest poprawny</li>
            <li>Jeśli zmieniły się kody CN lub transportu — zaktualizuj listy w zakładkach powyżej</li>
            <li>Wyślij testowy dokument do środowiska testowego PUESC i potwierdź akceptację</li>
          </ol>
          <p className="mt-3 text-xs text-blue-600">
            💡 System automatycznie wysyła email alert co poniedziałek jeśli wykryje zmiany na stronie PUESC.
          </p>
        </div>

      </div>
    </div>
  )
}
