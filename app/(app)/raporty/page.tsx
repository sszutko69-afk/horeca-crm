'use client'

import { useState } from 'react'

function fmt(n: number) { return n.toLocaleString('pl-PL', { minimumFractionDigits: 2 }) }

const SPRZEDAZ_TYGODNIOWA = [
  { dzien: 'Pn 04.11', kwota: 3_240 },
  { dzien: 'Wt 05.11', kwota: 2_890 },
  { dzien: 'Śr 06.11', kwota: 4_120 },
  { dzien: 'Cz 07.11', kwota: 5_650 },
  { dzien: 'Pt 08.11', kwota: 8_430 },
  { dzien: 'Sb 09.11', kwota: 11_200 },
  { dzien: 'Nd 10.11', kwota: 9_870 },
]

const TOP_DANIA = [
  { nazwa: 'Kotlet schabowy z ziemniakami', sprzedaz: 142, przychod: 7_100 },
  { nazwa: 'Łosoś grillowany z ryżem',      sprzedaz: 118, przychod: 8_024 },
  { nazwa: 'Pierogi ruskie (porcja 10 szt)', sprzedaz: 203, przychod: 6_496 },
  { nazwa: 'Tiramisu',                        sprzedaz: 274, przychod: 6_576 },
  { nazwa: 'Kawa espresso',                   sprzedaz: 521, przychod: 5_210 },
  { nazwa: 'Stek wołowy 300g',               sprzedaz:  89, przychod: 8_010 },
  { nazwa: 'Zupa dnia (zmiana)',              sprzedaz: 198, przychod: 3_960 },
]

const METODY_PLATNOSCI = [
  { metoda: 'Karta',   ilosc: 312, kwota: 28_450 },
  { metoda: 'Gotówka', ilosc:  98, kwota:  7_320 },
  { metoda: 'Terminal',ilosc:  54, kwota:  5_890 },
  { metoda: 'Przelew', ilosc:  12, kwota: 14_760 },
]

const FREKWENCJA = [
  { godzina: '12:00', stolik: 68 },
  { godzina: '13:00', stolik: 92 },
  { godzina: '14:00', stolik: 87 },
  { godzina: '15:00', stolik: 54 },
  { godzina: '18:00', stolik: 73 },
  { godzina: '19:00', stolik: 95 },
  { godzina: '20:00', stolik: 89 },
  { godzina: '21:00', stolik: 62 },
]

const MARZA_KAT = [
  { kat: 'Mięso i drób',      sprzedaz: 18_200, koszty: 7_280, marza: 10_920 },
  { kat: 'Ryby',               sprzedaz: 12_400, koszty: 6_820, marza:  5_580 },
  { kat: 'Zupy i przystawki',  sprzedaz:  6_300, koszty: 1_890, marza:  4_410 },
  { kat: 'Desery',             sprzedaz:  7_800, koszty: 2_340, marza:  5_460 },
  { kat: 'Kawa i napoje',      sprzedaz:  9_100, koszty: 1_820, marza:  7_280 },
  { kat: 'Alkohole',           sprzedaz: 11_500, koszty: 4_600, marza:  6_900 },
]

type Tab = 'obroty' | 'dania' | 'platnosci' | 'frekwencja' | 'marza'

export default function RaportyPage() {
  const [tab, setTab] = useState<Tab>('obroty')

  const totalSprzedaz = SPRZEDAZ_TYGODNIOWA.reduce((s, d) => s + d.kwota, 0)
  const maxDzien = Math.max(...SPRZEDAZ_TYGODNIOWA.map(d => d.kwota))
  const maxDanie = Math.max(...TOP_DANIA.map(d => d.przychod))
  const totalPlatnosci = METODY_PLATNOSCI.reduce((s, m) => s + m.kwota, 0)
  const maxFrekw = Math.max(...FREKWENCJA.map(f => f.stolik))

  const TABS: { id: Tab; label: string }[] = [
    { id: 'obroty',    label: 'Obroty' },
    { id: 'dania',     label: 'Top dania' },
    { id: 'platnosci', label: 'Płatności' },
    { id: 'frekwencja',label: 'Frekwencja' },
    { id: 'marza',     label: 'Marża' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-medium text-gray-900">Raporty</h1>
            <p className="text-sm text-gray-500 mt-0.5">Analityka restauracji — tydzień 04–10 listopada 2026</p>
          </div>
          <button className="text-sm border border-gray-200 bg-white rounded-lg px-4 py-2 hover:bg-gray-50 text-gray-600">
            ⬇ Eksport CSV
          </button>
        </div>

        {/* KPI summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Obrót tygodnia',    val: fmt(totalSprzedaz) + ' zł', color: '#2563EB' },
            { label: 'Śr. dzień',          val: fmt(totalSprzedaz / 7) + ' zł', color: '#7C3AED' },
            { label: 'Transakcji',         val: METODY_PLATNOSCI.reduce((s, m) => s + m.ilosc, 0), color: '#16a34a' },
            { label: 'Max frekwencja',     val: maxFrekw + '%', color: '#d97706' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className="text-lg font-bold mt-1" style={{ color: k.color }}>{k.val}</p>
            </div>
          ))}
        </div>

        {/* Zakładki */}
        <div className="flex gap-1 mb-5 border-b border-gray-200 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Obroty */}
        {tab === 'obroty' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Obroty dzienny — tydzień 04–10 listopada</h2>
            <div className="space-y-3">
              {SPRZEDAZ_TYGODNIOWA.map(d => (
                <div key={d.dzien} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16 shrink-0">{d.dzien}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                    <div className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${(d.kwota / maxDzien) * 100}%` }}>
                      <span className="text-xs text-white font-semibold whitespace-nowrap">{fmt(d.kwota)} zł</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between text-sm">
              <span className="text-gray-500">Suma tygodnia:</span>
              <span className="font-bold text-gray-900">{fmt(totalSprzedaz)} zł</span>
            </div>
          </div>
        )}

        {/* Top dania */}
        {tab === 'dania' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 text-sm font-semibold text-gray-900">
              Bestsellery — sprzedaż sztuk i przychód
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {['#', 'Danie', 'Sprzedano', 'Przychód', 'Udział'].map(h => (
                    <th key={h} className="py-2.5 px-4 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOP_DANIA.sort((a, b) => b.przychod - a.przychod).map((d, i) => (
                  <tr key={d.nazwa} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="py-3 px-4 font-medium text-gray-900">{d.nazwa}</td>
                    <td className="py-3 px-4 text-gray-600">{d.sprzedaz} szt.</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{fmt(d.przychod)} zł</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-100 rounded-full h-1.5 w-24 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(d.przychod / maxDanie) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round((d.przychod / maxDanie) * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Płatności */}
        {tab === 'platnosci' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Podział płatności — tydzień</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                {METODY_PLATNOSCI.map(m => (
                  <div key={m.metoda} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{m.metoda}</p>
                      <p className="text-xs text-gray-500">{m.ilosc} transakcji</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{fmt(m.kwota)} zł</p>
                      <p className="text-xs text-gray-400">{Math.round((m.kwota / totalPlatnosci) * 100)}% udziału</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Podział procentowy</p>
                {METODY_PLATNOSCI.map((m, i) => {
                  const colors = ['#2563EB', '#16a34a', '#7C3AED', '#d97706']
                  return (
                    <div key={m.metoda}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span style={{ color: colors[i] }} className="font-medium">{m.metoda}</span>
                        <span className="text-gray-400">{Math.round((m.kwota / totalPlatnosci) * 100)}%</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(m.kwota / totalPlatnosci) * 100}%`, background: colors[i] }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Frekwencja */}
        {tab === 'frekwencja' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Frekwencja stolików wg godziny</h2>
            <p className="text-xs text-gray-400 mb-4">Średnia obłożenia stolików w % — dane z piątku 08.11</p>
            <div className="flex items-end gap-3 h-40">
              {FREKWENCJA.map(f => (
                <div key={f.godzina} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-gray-700">{f.stolik}%</span>
                  <div className="w-full rounded-t-lg" style={{
                    height: `${(f.stolik / maxFrekw) * 100}%`,
                    background: f.stolik >= 90 ? '#16a34a' : f.stolik >= 70 ? '#2563EB' : '#E5E7EB',
                  }} />
                  <span className="text-xs text-gray-400">{f.godzina}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-600 inline-block"/> ≥90% — pełne obłożenie</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-600 inline-block"/> ≥70% — dobre obłożenie</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-200 inline-block"/> &lt;70% — wolne miejsca</span>
            </div>
          </div>
        )}

        {/* Marża */}
        {tab === 'marza' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 text-sm font-semibold text-gray-900">Analiza marży wg kategorii</div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {['Kategoria', 'Sprzedaż', 'Koszty', 'Marża', 'Marża %'].map(h => (
                    <th key={h} className="py-2.5 px-4 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MARZA_KAT.sort((a, b) => b.marza - a.marza).map(m => {
                  const pct = Math.round((m.marza / m.sprzedaz) * 100)
                  return (
                    <tr key={m.kat} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{m.kat}</td>
                      <td className="py-3 px-4 text-gray-700">{fmt(m.sprzedaz)} zł</td>
                      <td className="py-3 px-4 text-red-600">{fmt(m.koszty)} zł</td>
                      <td className="py-3 px-4 font-semibold text-green-700">{fmt(m.marza)} zł</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-gray-100 rounded-full h-1.5 w-16 overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs font-semibold ${pct >= 60 ? 'text-green-700' : pct >= 40 ? 'text-yellow-700' : 'text-red-600'}`}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td className="py-3 px-4 font-bold text-gray-900">RAZEM</td>
                  <td className="py-3 px-4 font-bold">{fmt(MARZA_KAT.reduce((s, m) => s + m.sprzedaz, 0))} zł</td>
                  <td className="py-3 px-4 font-bold text-red-600">{fmt(MARZA_KAT.reduce((s, m) => s + m.koszty, 0))} zł</td>
                  <td className="py-3 px-4 font-bold text-green-700">{fmt(MARZA_KAT.reduce((s, m) => s + m.marza, 0))} zł</td>
                  <td className="py-3 px-4 font-bold text-green-700">
                    {Math.round((MARZA_KAT.reduce((s, m) => s + m.marza, 0) / MARZA_KAT.reduce((s, m) => s + m.sprzedaz, 0)) * 100)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
