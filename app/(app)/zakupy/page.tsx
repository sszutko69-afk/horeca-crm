'use client'

import { useState } from 'react'

type Zakup = {
  id: string; nr: string; data: string; dostawca: string
  kategoria: string; opis: string; kwota_netto: number; kwota_brutto: number; status: 'zatwierdzona' | 'oczekuje'
}

const DEMO: Zakup[] = [
  { id: '1',  nr: 'FZ/2026/11/028', data: '2026-11-08', dostawca: 'Hurtownia Spożywcza "Mazur"', kategoria: 'Mięso i wędliny',   opis: 'Schab, pierś z kurczaka, wołowina — 45 kg',  kwota_netto: 1_900, kwota_brutto: 2_337, status: 'zatwierdzona' },
  { id: '2',  nr: 'FZ/2026/11/027', data: '2026-11-07', dostawca: 'Winnica Polska Sp. z o.o.',    kategoria: 'Alkohole i wina',   opis: 'Wino białe i czerwone — 24 butelki',         kwota_netto: 1_020, kwota_brutto: 1_254, status: 'zatwierdzona' },
  { id: '3',  nr: 'FZ/2026/11/026', data: '2026-11-07', dostawca: 'FreshVeg Dostawy',             kategoria: 'Warzywa i owoce',  opis: 'Pomidory, sałata, cebula, ziemniaki — 60 kg', kwota_netto:   540, kwota_brutto:   664, status: 'zatwierdzona' },
  { id: '4',  nr: 'FZ/2026/11/025', data: '2026-11-06', dostawca: 'Kraft Browar Sp. z o.o.',      kategoria: 'Alkohole i wina',   opis: 'Piwo craft — 50 litrów (keg 20L x2 + 10L)',  kwota_netto:   780, kwota_brutto:   959, status: 'zatwierdzona' },
  { id: '5',  nr: 'FZ/2026/11/024', data: '2026-11-05', dostawca: 'BioMleko PL',                  kategoria: 'Nabiał i jaja',    opis: 'Śmietana, masło, sery, jaja — tygodniowy dostaw',kwota_netto:  630, kwota_brutto:   775, status: 'oczekuje'    },
  { id: '6',  nr: 'FZ/2026/11/023', data: '2026-11-05', dostawca: 'Kawiarnia Hurt Sp. z o.o.',    kategoria: 'Kawa i herbata',   opis: 'Kawa espresso blend 10 kg + herbaty',         kwota_netto:   890, kwota_brutto: 1_095, status: 'zatwierdzona' },
  { id: '7',  nr: 'FZ/2026/11/022', data: '2026-11-04', dostawca: 'Piekarnia Regionalna',         kategoria: 'Pieczywo',         opis: 'Chleby, bagietki, bułki — codzienna dostawa',  kwota_netto:   310, kwota_brutto:   381, status: 'zatwierdzona' },
  { id: '8',  nr: 'FZ/2026/11/021', data: '2026-11-03', dostawca: 'RybyŚwieże.pl',                kategoria: 'Ryby i owoce morza',opis: 'Łosoś norweski, dorsz, krewetki — 20 kg',     kwota_netto: 1_540, kwota_brutto: 1_894, status: 'zatwierdzona' },
]

const KATEGORIE = ['Mięso i wędliny', 'Ryby i owoce morza', 'Warzywa i owoce', 'Nabiał i jaja', 'Alkohole i wina', 'Kawa i herbata', 'Pieczywo', 'Inne']

function fmt(n: number) { return n.toLocaleString('pl-PL', { minimumFractionDigits: 2 }) }

export default function ZakupyPage() {
  const [search, setSearch] = useState('')
  const [filterKat, setFilterKat] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ dostawca: '', kategoria: 'Mięso i wędliny', opis: '', kwota_netto: '' })
  const [zakupy, setZakupy] = useState<Zakup[]>(DEMO)
  const [saved, setSaved] = useState('')

  const filtered = zakupy.filter(z =>
    (z.dostawca.toLowerCase().includes(search.toLowerCase()) || z.opis.toLowerCase().includes(search.toLowerCase()) || z.nr.includes(search)) &&
    (filterKat ? z.kategoria === filterKat : true)
  )

  const brutto = zakupy.reduce((s, z) => s + z.kwota_brutto, 0)
  const tenDay = zakupy.filter(z => z.data >= '2026-11-05').reduce((s, z) => s + z.kwota_brutto, 0)

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const netto = parseFloat(form.kwota_netto) || 0
    const nowy: Zakup = {
      id: Date.now().toString(),
      nr: `FZ/2026/11/${(zakupy.length + 29).toString().padStart(3, '0')}`,
      data: new Date().toISOString().split('T')[0],
      dostawca: form.dostawca, kategoria: form.kategoria, opis: form.opis,
      kwota_netto: netto, kwota_brutto: parseFloat((netto * 1.23).toFixed(2)), status: 'oczekuje',
    }
    setZakupy(p => [nowy, ...p])
    setForm({ dostawca: '', kategoria: 'Mięso i wędliny', opis: '', kwota_netto: '' })
    setShowForm(false)
    setSaved('Zakup zapisany!'); setTimeout(() => setSaved(''), 3000)
  }

  const inp = "px-3 py-2 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
  const lbl = "text-xs font-medium text-gray-500 uppercase tracking-wide"

  const katStats = KATEGORIE.map(k => ({
    k, sum: zakupy.filter(z => z.kategoria === k).reduce((s, z) => s + z.kwota_brutto, 0),
  })).filter(x => x.sum > 0).sort((a, b) => b.sum - a.sum)
  const maxKat = Math.max(...katStats.map(x => x.sum), 1)

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-medium text-gray-900">Zakupy</h1>
            <p className="text-sm text-gray-500 mt-0.5">Rejestr zakupów od dostawców · {zakupy.length} dokumentów</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 hover:bg-gray-700">
            + Nowy zakup
          </button>
        </div>

        {saved && <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mb-4">{saved}</p>}

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Zakupy razem', val: fmt(brutto) + ' zł', color: '#2563EB' },
            { label: 'Ostatnie 7 dni', val: fmt(tenDay) + ' zł', color: '#7C3AED' },
            { label: 'Dostawców', val: new Set(zakupy.map(z => z.dostawca)).size, color: '#16a34a' },
            { label: 'Pozycji', val: zakupy.length, color: '#d97706' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className="text-lg font-bold mt-1" style={{ color: k.color }}>{k.val}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-5">
          {/* Tabela */}
          <div className="md:col-span-2">
            <div className="flex gap-3 mb-4 flex-wrap">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="🔍 Szukaj po dostawcy, opisie, numerze..."
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={filterKat} onChange={e => setFilterKat(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Wszystkie kategorie</option>
                {KATEGORIE.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['Nr', 'Data', 'Dostawca', 'Kategoria', 'Opis', 'Brutto', 'Status'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((z, i) => (
                      <tr key={z.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                        <td className="py-2.5 px-3 font-mono text-xs text-gray-400">{z.nr}</td>
                        <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap text-xs">{z.data}</td>
                        <td className="py-2.5 px-3 font-medium text-gray-800 text-xs max-w-[120px] truncate" title={z.dostawca}>{z.dostawca}</td>
                        <td className="py-2.5 px-3 text-xs">
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">{z.kategoria}</span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 text-xs max-w-[160px] truncate" title={z.opis}>{z.opis}</td>
                        <td className="py-2.5 px-3 font-semibold text-gray-900 text-right whitespace-nowrap">{fmt(z.kwota_brutto)} zł</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${z.status === 'zatwierdzona' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                            {z.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="py-10 text-center text-sm text-gray-400">Brak wyników</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Top kategorie */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden self-start">
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Zakupy wg kategorii</div>
            <div className="p-4 space-y-3">
              {katStats.map(x => (
                <div key={x.k}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700 font-medium">{x.k}</span>
                    <span className="text-gray-500">{fmt(x.sum)} zł</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(x.sum / maxKat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md">
            <h2 className="text-base font-medium text-gray-900 mb-4">Nowy zakup</h2>
            <form onSubmit={handleAdd}>
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-col gap-1.5">
                  <label className={lbl}>Dostawca</label>
                  <input value={form.dostawca} onChange={e => setForm(p => ({ ...p, dostawca: e.target.value }))}
                    required placeholder="Nazwa dostawcy" className={inp} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={lbl}>Kategoria</label>
                  <select value={form.kategoria} onChange={e => setForm(p => ({ ...p, kategoria: e.target.value }))} className={inp}>
                    {KATEGORIE.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={lbl}>Opis</label>
                  <input value={form.opis} onChange={e => setForm(p => ({ ...p, opis: e.target.value }))}
                    placeholder="np. Łosoś norweski 20 kg" className={inp} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={lbl}>Kwota netto (zł)</label>
                  <input type="number" min="0" step="0.01" value={form.kwota_netto}
                    onChange={e => setForm(p => ({ ...p, kwota_netto: e.target.value }))}
                    required placeholder="0.00" className={inp} />
                  {form.kwota_netto && (
                    <p className="text-xs text-gray-400">Brutto (23% VAT): {fmt(parseFloat(form.kwota_netto) * 1.23)} zł</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                <button type="submit"
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700">Zapisz</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
