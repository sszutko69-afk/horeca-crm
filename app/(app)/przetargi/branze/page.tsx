'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Branza = {
  id: string
  nazwa: string
  kolor: string
  cpv_kody: string[]
  aktywna: boolean
}

const KOLORY = ['blue','orange','green','purple','red','teal','yellow','gray']

export default function BranzePage() {
  const supabase = createClient()
  const [branze, setBranze] = useState<Branza[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string|null>(null)
  const [newCpv, setNewCpv] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Nowa branża
  const [newNazwa, setNewNazwa] = useState('')
  const [newKolor, setNewKolor] = useState('blue')
  const [newCpvKody, setNewCpvKody] = useState('')

  useEffect(() => { fetchBranze() }, [])

  async function fetchBranze() {
    const { data } = await supabase.from('przetargi_branze').select('*').order('nazwa')
    if (data) setBranze(data)
    setLoading(false)
  }

  async function toggleAktywna(b: Branza) {
    await supabase.from('przetargi_branze').update({ aktywna: !b.aktywna }).eq('id', b.id)
    setBranze(prev => prev.map(x => x.id === b.id ? {...x, aktywna: !b.aktywna} : x))
  }

  async function addCpv(b: Branza, cpv: string) {
    cpv = cpv.trim().toUpperCase()
    if (!cpv || b.cpv_kody.includes(cpv)) return
    const updated = [...b.cpv_kody, cpv]
    await supabase.from('przetargi_branze').update({ cpv_kody: updated }).eq('id', b.id)
    setBranze(prev => prev.map(x => x.id === b.id ? {...x, cpv_kody: updated} : x))
    setNewCpv('')
  }

  async function removeCpv(b: Branza, cpv: string) {
    const updated = b.cpv_kody.filter(c => c !== cpv)
    await supabase.from('przetargi_branze').update({ cpv_kody: updated }).eq('id', b.id)
    setBranze(prev => prev.map(x => x.id === b.id ? {...x, cpv_kody: updated} : x))
  }

  async function addBranza() {
    if (!newNazwa.trim()) return
    setSaving(true); setError('')
    const cpvKody = newCpvKody.split(',').map(c => c.trim()).filter(Boolean)
    const { error: err } = await supabase.from('przetargi_branze').insert({
      nazwa: newNazwa.trim(),
      kolor: newKolor,
      cpv_kody: cpvKody,
      aktywna: true,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setNewNazwa(''); setNewCpvKody(''); setNewKolor('blue')
    setSuccess('Dodano branżę!'); setTimeout(() => setSuccess(''), 3000)
    fetchBranze()
    setSaving(false)
  }

  async function deleteBranza(id: string) {
    if (!confirm('Usunąć tę branżę?')) return
    await supabase.from('przetargi_branze').delete().eq('id', id)
    setBranze(prev => prev.filter(b => b.id !== id))
  }

  const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full"

  if (loading) return <div className="p-8 text-center text-gray-400">Ładowanie...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Branże i kody CPV</h1>
            <p className="text-sm text-gray-500 mt-0.5">Zarządzaj branżami i filtrami BZP</p>
          </div>
          <a href="/przetargi" className="text-sm border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">
            ← Wróć do przetargów
          </a>
        </div>

        {success && <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2 rounded-xl">{success}</p>}
        {error   && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-xl">{error}</p>}

        {/* Lista branż */}
        <div className="space-y-3 mb-6">
          {branze.map(b => (
            <div key={b.id} className={`bg-white border rounded-xl p-4 ${b.aktywna ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full bg-${b.kolor}-500`} />
                  <span className="font-medium text-gray-900">{b.nazwa}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${b.aktywna ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {b.aktywna ? 'Aktywna' : 'Nieaktywna'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleAktywna(b)}
                    className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                    {b.aktywna ? 'Wyłącz' : 'Włącz'}
                  </button>
                  <button onClick={() => deleteBranza(b.id)}
                    className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50">
                    Usuń
                  </button>
                </div>
              </div>

              {/* Kody CPV */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Kody CPV ({b.cpv_kody.length}) — przetargi z tymi kodami będą pobierane z BZP:</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {b.cpv_kody.map(cpv => (
                    <span key={cpv} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full">
                      {cpv}
                      <button onClick={() => removeCpv(b, cpv)} className="text-blue-400 hover:text-red-500 ml-0.5">×</button>
                    </span>
                  ))}
                  {b.cpv_kody.length === 0 && <span className="text-xs text-gray-400 italic">Brak kodów CPV</span>}
                </div>
                {/* Dodaj CPV */}
                {editId === b.id ? (
                  <div className="flex gap-2">
                    <input value={newCpv} onChange={e => setNewCpv(e.target.value.toUpperCase())}
                      placeholder="np. 09120000-6"
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white flex-1"
                      onKeyDown={e => { if(e.key==='Enter') { addCpv(b, newCpv); setEditId(null) } if(e.key==='Escape') setEditId(null) }}
                    />
                    <button onClick={() => { addCpv(b, newCpv); setEditId(null) }}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">Dodaj</button>
                    <button onClick={() => setEditId(null)} className="text-xs border border-gray-200 px-2 py-1.5 rounded-lg">✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setEditId(b.id); setNewCpv('') }}
                    className="text-xs text-blue-600 hover:underline">+ Dodaj kod CPV</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Dodaj nową branżę */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-medium text-gray-900 mb-4">+ Dodaj nową branżę</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nazwa branży</label>
              <input value={newNazwa} onChange={e => setNewNazwa(e.target.value)} placeholder="np. Energetyka" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Kolor</label>
              <div className="flex gap-2">
                {KOLORY.map(k => (
                  <button key={k} onClick={() => setNewKolor(k)}
                    className={`w-7 h-7 rounded-full bg-${k}-500 ${newKolor === k ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`} />
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Kody CPV (oddzielone przecinkami)</label>
              <input value={newCpvKody} onChange={e => setNewCpvKody(e.target.value)}
                placeholder="09120000-6, 45000000-7, 09123000-7" className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">Przetargi z tymi kodami będą automatycznie pobierane z BZP</p>
            </div>
            <button onClick={addBranza} disabled={!newNazwa.trim() || saving}
              className="w-full py-2.5 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-700 disabled:opacity-50 font-medium">
              {saving ? 'Dodawanie...' : 'Dodaj branżę'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
