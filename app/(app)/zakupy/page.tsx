'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import CzatPanel from '@/components/CzatPanel'
import { createClient } from '@/lib/supabase'

type Zakup = {
  id: string; nr_edd: string; data_zakupu: string; dostawca: string | null
  ilosc_kg: number; cena_jednostkowa: number
  wartosc_netto: number; wartosc_brutto: number; dokumenty: string[] | null
}
type FormState = { nr_edd: string; data_zakupu: string; dostawca: string; ilosc_kg: string; cena_jednostkowa: string }

const emptyForm: FormState = { nr_edd: '', data_zakupu: new Date().toISOString().split('T')[0], dostawca: '', ilosc_kg: '', cena_jednostkowa: '' }
const VAT = 0.23
const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
const labelCls = "text-xs font-medium text-gray-500 uppercase tracking-wide"

export default function ZakupyPage() {
  const supabase = createClient()
  const [zakupy, setZakupy] = useState<Zakup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteNr, setDeleteNr] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [docsId, setDocsId] = useState<string | null>(null)
  const [docsNr, setDocsNr] = useState('')
  const [docs, setDocs] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Checkboxy i usuwanie zbiorcze
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showDeleteBulk, setShowDeleteBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)

  // Wyszukiwanie
  const [search, setSearch] = useState('')

  // Dual scroll
  const topScrollRef = useRef<HTMLDivElement>(null)
  const bottomScrollRef = useRef<HTMLDivElement>(null)
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const [tableWidth, setTableWidth] = useState(0)

  useEffect(() => { fetchZakupy() }, [])

  useEffect(() => {
    if (tableWrapRef.current) {
      const obs = new ResizeObserver(() => {
        if (tableWrapRef.current) setTableWidth(tableWrapRef.current.scrollWidth)
      })
      obs.observe(tableWrapRef.current)
      return () => obs.disconnect()
    }
  }, [loading])

  const syncTop = useCallback(() => {
    if (topScrollRef.current && bottomScrollRef.current)
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft
  }, [])
  const syncBottom = useCallback(() => {
    if (topScrollRef.current && bottomScrollRef.current)
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft
  }, [])

  function fmt(n: number, d = 2) { return n.toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) }
  function calc(kg: string, cena: string) { const v = parseFloat(kg) * parseFloat(cena); return isNaN(v) ? null : v }

  const netto = calc(form.ilosc_kg, form.cena_jednostkowa)
  const brutto = netto !== null ? netto * (1 + VAT) : null
  const editNetto = calc(editForm.ilosc_kg, editForm.cena_jednostkowa)
  const editBrutto = editNetto !== null ? editNetto * (1 + VAT) : null

  async function fetchZakupy() {
    setLoading(true)
    const { data } = await supabase.from('zakupy').select('*').order('data_zakupu', { ascending: false })
    if (data) setZakupy(data)
    setLoading(false)
    setSelected(new Set())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setSuccess('')
    const { error } = await supabase.from('zakupy').insert({
      nr_edd: form.nr_edd.trim(), data_zakupu: form.data_zakupu,
      dostawca: form.dostawca.trim() || null,
      ilosc_kg: parseFloat(form.ilosc_kg),
      cena_jednostkowa: parseFloat(form.cena_jednostkowa),
    })
    if (error) setError(error.message.includes('unique') ? 'Numer EDD już istnieje.' : 'Błąd: ' + error.message)
    else { setSuccess('Zakup zapisany!'); setForm({ ...emptyForm, data_zakupu: new Date().toISOString().split('T')[0] }); fetchZakupy(); setTimeout(() => setSuccess(''), 3000) }
    setSaving(false)
  }

  function openEdit(z: Zakup) {
    setEditId(z.id); setEditError('')
    setEditForm({ nr_edd: z.nr_edd, data_zakupu: z.data_zakupu, dostawca: z.dostawca ?? '', ilosc_kg: String(z.ilosc_kg), cena_jednostkowa: String(z.cena_jednostkowa) })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editId) return; setEditSaving(true); setEditError('')
    const { error } = await supabase.from('zakupy').update({
      nr_edd: editForm.nr_edd.trim(), data_zakupu: editForm.data_zakupu,
      dostawca: editForm.dostawca.trim() || null,
      ilosc_kg: parseFloat(editForm.ilosc_kg),
      cena_jednostkowa: parseFloat(editForm.cena_jednostkowa),
    }).eq('id', editId)
    if (error) setEditError('Błąd: ' + error.message)
    else { setEditId(null); fetchZakupy() }
    setEditSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return; setDeleting(true)
    await supabase.from('zakupy').delete().eq('id', deleteId)
    setDeleteId(null); fetchZakupy(); setDeleting(false)
  }

  async function handleDeleteBulk() {
    setDeletingBulk(true)
    const ids = Array.from(selected)
    for (let i = 0; i < ids.length; i += 50)
      await supabase.from('zakupy').delete().in('id', ids.slice(i, i + 50))
    setShowDeleteBulk(false); setSelected(new Set()); fetchZakupy(); setDeletingBulk(false)
  }

  function openDocs(z: Zakup) { setDocsId(z.id); setDocsNr(z.nr_edd); setDocs(z.dokumenty ?? []) }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files; if (!files || !docsId) return
    setUploading(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `zakupy/${docsId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('dokumenty').upload(path, file)
      if (!error) { const { data } = supabase.storage.from('dokumenty').getPublicUrl(path); urls.push(data.publicUrl) }
    }
    const updated = [...docs, ...urls]
    await supabase.from('zakupy').update({ dokumenty: updated }).eq('id', docsId)
    setDocs(updated); setZakupy(prev => prev.map(z => z.id === docsId ? { ...z, dokumenty: updated } : z))
    setUploading(false); if (fileRef.current) fileRef.current.value = ''
  }

  async function handleDeleteDoc(url: string) {
    if (!docsId) return
    const updated = docs.filter(d => d !== url)
    await supabase.from('zakupy').update({ dokumenty: updated }).eq('id', docsId)
    setDocs(updated); setZakupy(prev => prev.map(z => z.id === docsId ? { ...z, dokumenty: updated } : z))
  }

  function isImage(url: string) { return /\.(jpg|jpeg|png|gif|webp)$/i.test(url) }

  // Filtrowanie
  const filtered = zakupy.filter(z => {
    const q = search.toLowerCase()
    return !q || z.nr_edd.toLowerCase().includes(q) || (z.dostawca ?? '').toLowerCase().includes(q) || z.data_zakupu.includes(q)
  })

  const allSelected = filtered.length > 0 && filtered.every(z => selected.has(z.id))
  const someSelected = filtered.some(z => selected.has(z.id))

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(filtered.map(z => z.id)))
  }
  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // Sumy
  const sumaKg = filtered.reduce((a, z) => a + z.ilosc_kg, 0)
  const sumaNetto = filtered.reduce((a, z) => a + (z.wartosc_netto ?? z.ilosc_kg * z.cena_jednostkowa), 0)
  const sumaBrutto = filtered.reduce((a, z) => a + (z.wartosc_brutto ?? z.ilosc_kg * z.cena_jednostkowa * (1 + VAT)), 0)

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-full mx-auto">

        {/* Nagłówek */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-medium text-gray-900">Zakupy gazu</h1>
            <p className="text-sm text-gray-500 mt-0.5">Ewidencja zakupów wg numerów EDD · {zakupy.length} łącznie</p>
          </div>
          <a href="/dashboard" className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">← Dashboard</a>
        </div>

        {/* Formularz nowego zakupu */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Nowy zakup</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Nr EDD</label>
                <input value={form.nr_edd} onChange={e => setForm(f => ({ ...f, nr_edd: e.target.value }))} placeholder="25PLDD200331..." required className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Data zakupu</label>
                <input type="date" value={form.data_zakupu} onChange={e => setForm(f => ({ ...f, data_zakupu: e.target.value }))} required className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className={labelCls}>Dostawca</label>
                <input value={form.dostawca} onChange={e => setForm(f => ({ ...f, dostawca: e.target.value }))} placeholder="Nazwa firmy dostawcy" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Ilość [kg]</label>
                <input type="number" value={form.ilosc_kg} onChange={e => setForm(f => ({ ...f, ilosc_kg: e.target.value }))} placeholder="0" min="0" step="0.01" required className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Cena netto [zł/kg]</label>
                <input type="number" value={form.cena_jednostkowa} onChange={e => setForm(f => ({ ...f, cena_jednostkowa: e.target.value }))} placeholder="0.0000" min="0" step="0.0001" required className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Wartość netto [zł] — auto</label>
                <input value={netto !== null ? fmt(netto) : ''} readOnly className={inputCls + ' bg-gray-50 text-gray-500'} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Wartość brutto [zł] — auto (VAT 23%)</label>
                <input value={brutto !== null ? fmt(brutto) : ''} readOnly className={inputCls + ' bg-gray-50 text-gray-700 font-medium'} />
              </div>
            </div>

            {/* Info o przeliczeniu */}
            {form.cena_jednostkowa && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3 text-xs text-blue-700">
                Cena netto: <span className="font-medium">{fmt(parseFloat(form.cena_jednostkowa), 4)} zł/kg</span> →
                Cena brutto: <span className="font-medium">{fmt(parseFloat(form.cena_jednostkowa) * (1 + VAT), 4)} zł/kg</span> ·
                Cena netto/t: <span className="font-medium">{fmt(parseFloat(form.cena_jednostkowa) * 1000)} zł/t</span> ·
                Cena brutto/t: <span className="font-medium">{fmt(parseFloat(form.cena_jednostkowa) * 1000 * (1 + VAT))} zł/t</span>
              </div>
            )}

            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>}
            {success && <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg mb-3">{success}</p>}
            <button type="submit" disabled={saving} className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
              {saving ? 'Zapisywanie...' : '+ Dodaj zakup'}
            </button>
          </form>
        </div>

        {/* Historia zakupów */}
        <div className="bg-white border border-gray-200 rounded-xl">
          {/* Toolbar */}
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Historia zakupów {!loading && `(${filtered.length}${filtered.length !== zakupy.length ? ` z ${zakupy.length}` : ''})`}
              </h2>
              {selected.size > 0 && (
                <button onClick={() => setShowDeleteBulk(true)}
                  className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                  🗑 Usuń zaznaczone ({selected.size})
                </button>
              )}
            </div>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍  Szukaj po EDD, dostawcy, dacie..."
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-md"
            />
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Ładowanie...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Brak wyników.</p>
          ) : (
            <>
              {/* Górny pasek scroll */}
              <div ref={topScrollRef} onScroll={syncTop} className="overflow-x-auto border-b border-gray-100" style={{ height: 12 }}>
                <div style={{ width: tableWidth, height: 1 }} />
              </div>

              {/* Tabela */}
              <div ref={bottomScrollRef} onScroll={syncBottom} className="overflow-x-auto">
                <div ref={tableWrapRef}>
                  <table className="w-full text-sm border-collapse" style={{ minWidth: 900 }}>
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="py-3 pl-4 pr-2 w-8">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                            onChange={toggleAll}
                            className="rounded"
                          />
                        </th>
                        {[
                          { l: 'Nr EDD', r: false },
                          { l: 'Data', r: false },
                          { l: 'Dostawca', r: false },
                          { l: 'Ilość [kg]', r: true },
                          { l: 'Cena netto [zł/kg]', r: true },
                          { l: 'Cena brutto [zł/kg]', r: true },
                          { l: 'Wartość netto', r: true },
                          { l: 'Wartość brutto', r: true },
                          { l: 'Akcje', r: false },
                        ].map(h => (
                          <th key={h.l} className={`text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-2 whitespace-nowrap ${h.r ? 'text-right' : h.l === 'Akcje' ? 'text-center' : 'text-left'}`}>{h.l}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(z => {
                        const wNetto = z.wartosc_netto ?? z.ilosc_kg * z.cena_jednostkowa
                        const wBrutto = z.wartosc_brutto ?? wNetto * (1 + VAT)
                        const isSelected = selected.has(z.id)
                        return (
                          <tr key={z.id} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                            <td className="py-2.5 pl-4 pr-2">
                              <input type="checkbox" checked={isSelected} onChange={() => toggleOne(z.id)} className="rounded" />
                            </td>
                            <td className="py-2.5 px-2">
                              <span className="bg-blue-50 text-blue-700 text-xs font-mono px-1.5 py-0.5 rounded whitespace-nowrap">{z.nr_edd.slice(-9)}</span>
                              <span className="text-xs text-gray-400 ml-1">{z.nr_edd.slice(0, 12)}</span>
                            </td>
                            <td className="py-2.5 px-2 text-gray-600 whitespace-nowrap">{z.data_zakupu}</td>
                            <td className="py-2.5 px-2 text-gray-700">{z.dostawca || <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 px-2 text-right font-medium tabular-nums">{fmt(z.ilosc_kg, 0)}</td>
                            <td className="py-2.5 px-2 text-right text-gray-600 tabular-nums">{fmt(z.cena_jednostkowa, 4)} zł</td>
                            <td className="py-2.5 px-2 text-right text-gray-600 tabular-nums">{fmt(z.cena_jednostkowa * (1 + VAT), 4)} zł</td>
                            <td className="py-2.5 px-2 text-right text-gray-600 tabular-nums">{fmt(wNetto)} zł</td>
                            <td className="py-2.5 px-2 text-right font-medium tabular-nums">{fmt(wBrutto)} zł</td>
                            <td className="py-2.5 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => openDocs(z)} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-500" title="Dokumenty">
                                  📎{z.dokumenty?.length ? ` ${z.dokumenty.length}` : ''}
                                </button>
                                <button onClick={() => openEdit(z)} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors text-gray-500">Edytuj</button>
                                <button onClick={() => { setDeleteId(z.id); setDeleteNr(z.nr_edd) }} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors text-gray-500">Usuń</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={4} className="py-3 pl-4 text-xs text-gray-500 font-medium">
                          Suma: {filtered.length} partii{selected.size > 0 ? ` · ${selected.size} zaznaczonych` : ''}
                        </td>
                        <td className="py-3 px-2 text-right font-bold tabular-nums">{fmt(sumaKg, 0)} kg</td>
                        <td colSpan={2}></td>
                        <td className="py-3 px-2 text-right font-bold tabular-nums">{fmt(sumaNetto)} zł</td>
                        <td className="py-3 px-2 text-right font-bold tabular-nums">{fmt(sumaBrutto)} zł</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal edycji */}
      {editId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-lg">
            <h2 className="text-base font-medium text-gray-900 mb-4">Edytuj zakup</h2>
            <form onSubmit={handleEdit}>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="flex flex-col gap-1.5 col-span-2"><label className={labelCls}>Nr EDD</label><input value={editForm.nr_edd} onChange={e => setEditForm(f => ({ ...f, nr_edd: e.target.value }))} required className={inputCls} /></div>
                <div className="flex flex-col gap-1.5"><label className={labelCls}>Data zakupu</label><input type="date" value={editForm.data_zakupu} onChange={e => setEditForm(f => ({ ...f, data_zakupu: e.target.value }))} required className={inputCls} /></div>
                <div className="flex flex-col gap-1.5"><label className={labelCls}>Dostawca</label><input value={editForm.dostawca} onChange={e => setEditForm(f => ({ ...f, dostawca: e.target.value }))} className={inputCls} /></div>
                <div className="flex flex-col gap-1.5"><label className={labelCls}>Ilość [kg]</label><input type="number" value={editForm.ilosc_kg} onChange={e => setEditForm(f => ({ ...f, ilosc_kg: e.target.value }))} min="0" step="0.01" required className={inputCls} /></div>
                <div className="flex flex-col gap-1.5"><label className={labelCls}>Cena netto [zł/kg]</label><input type="number" value={editForm.cena_jednostkowa} onChange={e => setEditForm(f => ({ ...f, cena_jednostkowa: e.target.value }))} min="0" step="0.0001" required className={inputCls} /></div>
                <div className="flex flex-col gap-1.5"><label className={labelCls}>Wartość netto — auto</label><input value={editNetto !== null ? fmt(editNetto) : ''} readOnly className={inputCls + ' bg-gray-50 text-gray-500'} /></div>
                <div className="flex flex-col gap-1.5"><label className={labelCls}>Wartość brutto — auto</label><input value={editBrutto !== null ? fmt(editBrutto) : ''} readOnly className={inputCls + ' bg-gray-50 font-medium'} /></div>
              </div>
              {editError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{editError}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditId(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                <button type="submit" disabled={editSaving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">{editSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal usunięcia */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-900 mb-2">Usuń zakup</h2>
            <p className="text-sm text-gray-500 mb-5">Czy na pewno usunąć <span className="font-medium">{deleteNr}</span>?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{deleting ? 'Usuwanie...' : 'Tak, usuń'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal usunięcia zbiorczego */}
      {showDeleteBulk && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-900 mb-2">Usuń zaznaczone zakupy</h2>
            <p className="text-sm text-gray-500 mb-1">Czy na pewno chcesz usunąć <strong>{selected.size}</strong> zaznaczonych zakupów?</p>
            <p className="text-xs text-red-600 mb-5">⚠ Tej operacji nie można cofnąć!</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteBulk(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={handleDeleteBulk} disabled={deletingBulk} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{deletingBulk ? 'Usuwanie...' : `Usuń ${selected.size} zakupów`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal dokumentów */}
      {docsId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-gray-900">Dokumenty — <span className="text-blue-700">{docsNr}</span></h2>
              <button onClick={() => setDocsId(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            {docs.length === 0 ? <p className="text-sm text-gray-400 mb-4">Brak dokumentów.</p> : (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {docs.map((url, i) => (
                  <div key={i} className="relative group border border-gray-200 rounded-lg overflow-hidden">
                    {isImage(url) ? <img src={url} alt="" className="w-full h-24 object-cover" /> : (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-24 bg-gray-50 hover:bg-gray-100">
                        <span className="text-2xl mb-1">📄</span>
                        <span className="text-xs text-gray-500 truncate w-full text-center px-1">{url.split('/').pop()}</span>
                      </a>
                    )}
                    <button onClick={() => handleDeleteDoc(url)} className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-gray-300 transition-colors">
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf" onChange={handleUpload} className="hidden" id="file-upload" />
              <label htmlFor="file-upload" className="cursor-pointer">
                <p className="text-sm font-medium text-gray-600 mb-1">{uploading ? 'Przesyłanie...' : 'Kliknij aby dodać pliki'}</p>
                <p className="text-xs text-gray-400">Zdjęcia lub PDF</p>
              </label>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setDocsId(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Zamknij</button>
            </div>
          </div>
        </div>
      )}
      {/* Pływający przycisk czatu */}
      <CzatPanel modul="zakupy" compact />

    </div>
  )
}
