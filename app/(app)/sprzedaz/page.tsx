'use client'

import { useState } from 'react'

type Faktura = {
  id: string; nr: string; data: string; klient: string; opis: string
  kwota_netto: number; kwota_brutto: number
  forma: string; platnosc: string; status: 'opłacona' | 'oczekuje' | 'zaległa'
}

const DEMO: Faktura[] = [
  { id: '1',  nr: 'FV/2026/11/042', data: '2026-11-08', klient: 'Hotel Marriott Warszawa',    opis: 'Catering — bankiet firmowy 80 os.', kwota_netto: 12_000, kwota_brutto: 14_760, forma: 'faktura_vat', platnosc: 'przelew',  status: 'opłacona' },
  { id: '2',  nr: 'FV/2026/11/041', data: '2026-11-07', klient: 'Restauracja "Pod Lipą"',     opis: 'Dostawa: produkty garmażeryjne',   kwota_netto:  2_400, kwota_brutto:  2_952, forma: 'faktura_vat', platnosc: 'przelew',  status: 'oczekuje' },
  { id: '3',  nr: 'FV/2026/11/040', data: '2026-11-06', klient: 'Catering Mazowsze Sp. z o.o.',opis: 'Usługa cateringowa — konferencja',  kwota_netto:  8_500, kwota_brutto: 10_455, forma: 'faktura_vat', platnosc: 'przelew',  status: 'opłacona' },
  { id: '4',  nr: 'FV/2026/11/039', data: '2026-11-05', klient: 'Hotel Bristol Kraków',       opis: 'Dostawa: alkohole i wina premium',  kwota_netto:  5_200, kwota_brutto:  6_396, forma: 'faktura_vat', platnosc: 'karta',    status: 'opłacona' },
  { id: '5',  nr: 'FV/2026/11/038', data: '2026-11-04', klient: 'Pensjonat "Pod Brzozą"',     opis: 'Śniadania grupowe — 3 dni, 40 os.',kwota_netto:  3_600, kwota_brutto:  4_428, forma: 'faktura_vat', platnosc: 'przelew',  status: 'zaległa'  },
  { id: '6',  nr: 'FV/2026/11/037', data: '2026-11-03', klient: 'Eventim Events Sp. z o.o.',  opis: 'Catering — event plenerowy 150 os.',kwota_netto: 18_000, kwota_brutto: 22_140, forma: 'faktura_vat', platnosc: 'przelew',  status: 'opłacona' },
  { id: '7',  nr: 'FV/2026/11/036', data: '2026-11-01', klient: 'Hotel Ibis Centrum',         opis: 'Obsługa baru — weekend 1-2.11',    kwota_netto:  4_100, kwota_brutto:  5_043, forma: 'faktura_vat', platnosc: 'przelew',  status: 'oczekuje' },
]

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  opłacona: { bg: '#f0fdf4', color: '#16a34a' },
  oczekuje: { bg: '#fffbeb', color: '#d97706' },
  zaległa:  { bg: '#fef2f2', color: '#dc2626' },
}

function fmt(n: number) { return n.toLocaleString('pl-PL', { minimumFractionDigits: 2 }) }

export default function SprzedazPage() {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ klient: '', opis: '', kwota_netto: '', forma: 'faktura_vat', platnosc: 'przelew' })
  const [faktury, setFaktury] = useState<Faktura[]>(DEMO)
  const [saved, setSaved] = useState('')

  const filtered = faktury.filter(f =>
    (f.klient.toLowerCase().includes(search.toLowerCase()) || f.nr.includes(search) || f.opis.toLowerCase().includes(search.toLowerCase())) &&
    (filterStatus ? f.status === filterStatus : true)
  )

  const brutto = faktury.reduce((s, f) => s + f.kwota_brutto, 0)
  const oplacone = faktury.filter(f => f.status === 'opłacona').reduce((s, f) => s + f.kwota_brutto, 0)
  const zalega = faktury.filter(f => f.status === 'zaległa').reduce((s, f) => s + f.kwota_brutto, 0)

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const netto = parseFloat(form.kwota_netto) || 0
    const nowy: Faktura = {
      id: Date.now().toString(),
      nr: `FV/2026/11/${(faktury.length + 43).toString().padStart(3, '0')}`,
      data: new Date().toISOString().split('T')[0],
      klient: form.klient, opis: form.opis,
      kwota_netto: netto, kwota_brutto: parseFloat((netto * 1.23).toFixed(2)),
      forma: form.forma, platnosc: form.platnosc, status: 'oczekuje',
    }
    setFaktury(p => [nowy, ...p])
    setForm({ klient: '', opis: '', kwota_netto: '', forma: 'faktura_vat', platnosc: 'przelew' })
    setShowForm(false)
    setSaved('Faktura zapisana!'); setTimeout(() => setSaved(''), 3000)
  }

  const inp = "px-3 py-2 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
  const lbl = "text-xs font-medium text-gray-500 uppercase tracking-wide"

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-medium text-gray-900">Sprzedaż</h1>
            <p className="text-sm text-gray-500 mt-0.5">Faktury i dokumenty sprzedaży · {faktury.length} dokumentów</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 hover:bg-gray-700">
            + Nowa faktura
          </button>
        </div>

        {saved && <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mb-4">{saved}</p>}

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Obrót brutto', val: fmt(brutto) + ' zł', color: '#2563EB' },
            { label: 'Opłacono', val: fmt(oplacone) + ' zł', color: '#16a34a' },
            { label: 'Do zapłaty', val: fmt(brutto - oplacone - zalega) + ' zł', color: '#d97706' },
            { label: 'Zaległości', val: fmt(zalega) + ' zł', color: '#dc2626' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className="text-lg font-bold mt-1" style={{ color: k.color }}>{k.val}</p>
            </div>
          ))}
        </div>

        {/* Filtry */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Szukaj po kliencie, numerze, opisie..."
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Wszystkie statusy</option>
            <option value="opłacona">Opłacone</option>
            <option value="oczekuje">Oczekujące</option>
            <option value="zaległa">Zaległe</option>
          </select>
        </div>

        {/* Tabela */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Nr faktury', 'Data', 'Klient', 'Opis', 'Netto', 'Brutto', 'Płatność', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => (
                  <tr key={f.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                    <td className="py-3 px-4 font-mono text-xs text-gray-500">{f.nr}</td>
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{f.data}</td>
                    <td className="py-3 px-4 font-medium text-gray-900 max-w-[180px] truncate" title={f.klient}>{f.klient}</td>
                    <td className="py-3 px-4 text-gray-500 max-w-[180px] truncate" title={f.opis}>{f.opis}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{fmt(f.kwota_netto)} zł</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">{fmt(f.kwota_brutto)} zł</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{f.platnosc}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={STATUS_STYLE[f.status]}>
                        {f.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {f.status === 'oczekuje' && (
                        <button onClick={() => setFaktury(p => p.map(x => x.id === f.id ? { ...x, status: 'opłacona' } : x))}
                          className="text-xs text-blue-600 hover:underline whitespace-nowrap">Oznacz opłaconą</button>
                      )}
                      {f.status === 'zaległa' && (
                        <button onClick={() => setFaktury(p => p.map(x => x.id === f.id ? { ...x, status: 'oczekuje' } : x))}
                          className="text-xs text-orange-600 hover:underline whitespace-nowrap">Wyślij przypomnienie</button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="py-10 text-center text-sm text-gray-400">Brak wyników</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal nowej faktury */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md">
            <h2 className="text-base font-medium text-gray-900 mb-4">Nowa faktura</h2>
            <form onSubmit={handleAdd}>
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-col gap-1.5">
                  <label className={lbl}>Klient</label>
                  <input value={form.klient} onChange={e => setForm(p => ({ ...p, klient: e.target.value }))}
                    required placeholder="Nazwa firmy lub osoby" className={inp} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={lbl}>Opis usługi / towaru</label>
                  <input value={form.opis} onChange={e => setForm(p => ({ ...p, opis: e.target.value }))}
                    placeholder="np. Catering — bankiet 60 osób" className={inp} />
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className={lbl}>Forma sprzedaży</label>
                    <select value={form.forma} onChange={e => setForm(p => ({ ...p, forma: e.target.value }))} className={inp}>
                      <option value="faktura_vat">Faktura VAT</option>
                      <option value="paragon">Paragon</option>
                      <option value="wz">Dokument WZ</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={lbl}>Płatność</label>
                    <select value={form.platnosc} onChange={e => setForm(p => ({ ...p, platnosc: e.target.value }))} className={inp}>
                      <option value="przelew">Przelew</option>
                      <option value="karta">Karta</option>
                      <option value="gotówka">Gotówka</option>
                    </select>
                  </div>
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
