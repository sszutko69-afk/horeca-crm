'use client'

import { useState, useEffect } from 'react'
import { useSlownik } from '@/components/SlownikContext'
import { createClient } from '@/lib/supabase'

type Faktura = {
  id: string; nr: string; data: string; klient: string; opis: string
  kwota_netto: number; kwota_brutto: number
  forma: string; platnosc: string; status: 'opłacona' | 'oczekuje' | 'zaległa'
}

// w bazie statusy są zapisane bez polskich znaków
const STATUS_Z_BAZY: Record<string, Faktura['status']> = { oplacona: 'opłacona', oczekuje: 'oczekuje', zalegla: 'zaległa' }
const STATUS_DO_BAZY: Record<Faktura['status'], string> = { 'opłacona': 'oplacona', oczekuje: 'oczekuje', 'zaległa': 'zalegla' }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  opłacona: { bg: '#f0fdf4', color: '#16a34a' },
  oczekuje: { bg: '#fffbeb', color: '#d97706' },
  zaległa:  { bg: '#fef2f2', color: '#dc2626' },
}

function fmt(n: number) { return n.toLocaleString('pl-PL', { minimumFractionDigits: 2 }) }

export default function SprzedazPage() {
  const S = useSlownik()
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ klient: '', opis: '', kwota_netto: '', forma: 'faktura_vat', platnosc: 'przelew' })
  const [faktury, setFaktury] = useState<Faktura[]>([])
  const [klienci, setKlienci] = useState<{ id: string; nazwa: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const [{ data, error: err }, { data: kl }] = await Promise.all([
      supabase.from('sprzedaz')
        .select('id,nr_faktury,data_sprzedazy,opis,kwota_netto,kwota_brutto,forma_sprzedazy,forma_platnosci,status,klient_nazwa,klienci(nazwa)')
        .order('data_sprzedazy', { ascending: false }).order('created_at', { ascending: false }).limit(2000),
      supabase.from('klienci').select('id,nazwa').eq('aktywny', true).order('nazwa').limit(2000),
    ])
    if (err) { setError('Nie udało się wczytać sprzedaży: ' + err.message); setLoading(false); return }
    setKlienci(kl ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFaktury((data ?? []).map((r: any) => ({
      id: r.id, nr: r.nr_faktury ?? '', data: r.data_sprzedazy ?? '',
      klient: r.klienci?.nazwa ?? r.klient_nazwa ?? '', opis: r.opis ?? '',
      kwota_netto: Number(r.kwota_netto ?? 0), kwota_brutto: Number(r.kwota_brutto ?? 0),
      forma: r.forma_sprzedazy ?? 'faktura_vat', platnosc: r.forma_platnosci === 'gotowka' ? 'gotówka' : (r.forma_platnosci ?? ''),
      status: STATUS_Z_BAZY[r.status] ?? 'oczekuje',
    })))
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = faktury.filter(f =>
    (f.klient.toLowerCase().includes(search.toLowerCase()) || f.nr.includes(search) || f.opis.toLowerCase().includes(search.toLowerCase())) &&
    (filterStatus ? f.status === filterStatus : true)
  )

  const brutto = faktury.reduce((s, f) => s + f.kwota_brutto, 0)
  const oplacone = faktury.filter(f => f.status === 'opłacona').reduce((s, f) => s + f.kwota_brutto, 0)
  const zalega = faktury.filter(f => f.status === 'zaległa').reduce((s, f) => s + f.kwota_brutto, 0)

  function nastepnyNumer() {
    const d = new Date()
    const prefix = `FV/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/`
    const maks = faktury.filter(f => f.nr.startsWith(prefix)).map(f => parseInt(f.nr.slice(prefix.length), 10) || 0).reduce((a, b) => Math.max(a, b), 0)
    return prefix + String(maks + 1).padStart(3, '0')
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const netto = parseFloat(form.kwota_netto) || 0
    const nazwa = form.klient.trim()
    const znany = klienci.find(k => k.nazwa.trim().toLowerCase() === nazwa.toLowerCase())
    const { error: err } = await supabase.from('sprzedaz').insert({
      data_sprzedazy: new Date().toISOString().split('T')[0],
      nr_faktury: nastepnyNumer(),
      klient_id: znany?.id ?? null,
      klient_nazwa: znany ? null : nazwa,
      opis: form.opis,
      kwota_netto: netto, kwota_brutto: parseFloat((netto * 1.23).toFixed(2)),
      forma_sprzedazy: form.forma,
      forma_platnosci: form.platnosc === 'gotówka' ? 'gotowka' : form.platnosc,
      status: 'oczekuje',
    })
    setSaving(false)
    if (err) { setError('Nie udało się zapisać faktury: ' + err.message); return }
    setForm({ klient: '', opis: '', kwota_netto: '', forma: 'faktura_vat', platnosc: 'przelew' })
    setShowForm(false)
    setSaved('Faktura zapisana!'); setTimeout(() => setSaved(''), 3000)
    await load()
  }

  async function ustawStatus(id: string, status: Faktura['status']) {
    const poprzednie = faktury
    setFaktury(p => p.map(x => x.id === id ? { ...x, status } : x))
    const { error: err } = await supabase.from('sprzedaz').update({ status: STATUS_DO_BAZY[status] }).eq('id', id)
    if (err) { setFaktury(poprzednie); setError('Nie udało się zmienić statusu: ' + err.message) }
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

        {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-4">{error}</p>}
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
                      {f.status !== 'opłacona' && (
                        <button onClick={() => ustawStatus(f.id, 'opłacona')}
                          className="text-xs text-blue-600 hover:underline whitespace-nowrap mr-3">Oznacz opłaconą</button>
                      )}
                      {f.status === 'oczekuje' && (
                        <button onClick={() => ustawStatus(f.id, 'zaległa')}
                          className="text-xs text-orange-600 hover:underline whitespace-nowrap">Oznacz zaległą</button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="py-10 text-center text-sm text-gray-400">
                    {loading ? 'Wczytywanie…' : faktury.length === 0 ? 'Brak faktur. Dodaj pierwszą przyciskiem „+ Nowa faktura”.' : 'Brak wyników'}
                  </td></tr>
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
                    required placeholder="Nazwa firmy lub osoby" list="klienci-lista" className={inp} />
                  <datalist id="klienci-lista">{klienci.map(k => <option key={k.id} value={k.nazwa} />)}</datalist>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={lbl}>Opis usługi / towaru</label>
                  <input value={form.opis} onChange={e => setForm(p => ({ ...p, opis: e.target.value }))}
                    placeholder={S.przykladZamowienia} className={inp} />
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
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
