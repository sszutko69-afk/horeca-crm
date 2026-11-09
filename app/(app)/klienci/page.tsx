'use client'

import { useEffect, useState, useRef } from 'react'
import CzatPanel from '@/components/CzatPanel'
import { createClient } from '@/lib/supabase'
import * as XLSX from 'xlsx'

type Klient = {
  id: string; nazwa: string; typ: string; nip: string | null; pesel: string | null
  adres: string | null; miasto: string | null; kod_pocztowy: string | null
  telefon: string | null; email: string | null; uwagi: string | null
  aktywny: boolean; dokumenty: string[] | null
}

const emptyForm = {
  nazwa: '', typ: 'osoba_fizyczna', nip: '', pesel: '', adres: '',
  miasto: '', kod_pocztowy: '', telefon: '', email: '', uwagi: '',
}

const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
const labelCls = "text-xs font-medium text-gray-500 uppercase tracking-wide"

function daysSince(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000) }

function OstatniKupilBadge({ data }: { data: string | null }) {
  if (!data) return <span className="text-xs text-gray-300">brak</span>
  const days = daysSince(data)
  const d = new Date(data).toLocaleDateString('pl-PL')
  const cls = days <= 30 ? 'text-green-700 bg-green-50' : days <= 90 ? 'text-yellow-700 bg-yellow-50' : 'text-red-700 bg-red-50'
  const dot = days <= 30 ? 'bg-green-500' : days <= 90 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
      {d}{days > 90 ? ` · ${days} dni` : ''}
    </span>
  )
}

// Normalizacja do porównań duplikatów
function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,\-]/g, '')
}
function podobienstwo(a: string, b: string): number {
  const na = norm(a), nb = norm(b)
  if (na === nb) return 1
  if (!na || !nb) return 0
  const dp = Array.from({ length: na.length + 1 }, (_, i) =>
    Array.from({ length: nb.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0))
  for (let i = 1; i <= na.length; i++)
    for (let j = 1; j <= nb.length; j++)
      dp[i][j] = na[i-1] === nb[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return 1 - dp[na.length][nb.length] / Math.max(na.length, nb.length)
}

type FormState = typeof emptyForm

function KlientForm({ f, setF, onSubmit, onCancel, saving, title, docs, onUpload, onDeleteDoc, uploading, fileRef }: {
  f: FormState; setF: React.Dispatch<React.SetStateAction<FormState>>
  onSubmit: (e: React.FormEvent) => void; onCancel: () => void
  saving: boolean; title: string; docs: string[]
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDeleteDoc: (url: string) => void; uploading: boolean
  fileRef: React.RefObject<HTMLInputElement | null>
}) {
  const [gusLoading, setGusLoading] = useState(false)
  const [gusMsg, setGusMsg] = useState<{ typ: 'ok' | 'err'; txt: string } | null>(null)

  async function pobierzZGUS() {
    const nipClean = (f.nip || '').replace(/[^0-9]/g, '')
    if (nipClean.length !== 10) { setGusMsg({ typ: 'err', txt: 'Wpisz poprawny 10-cyfrowy NIP' }); return }
    setGusLoading(true); setGusMsg(null)
    try {
      const res = await fetch(`/api/gus?nip=${nipClean}`)
      const data = await res.json()
      if (!res.ok) { setGusMsg({ typ: 'err', txt: data.error ?? 'Błąd GUS' }); return }
      setF(p => ({
        ...p,
        nazwa: data.nazwa || p.nazwa,
        adres: data.adres || p.adres,
        kod_pocztowy: data.kod_pocztowy || p.kod_pocztowy,
        miasto: data.miasto || p.miasto,
      }))
      const vatInfo = data.statusVat ? ` · VAT: ${data.statusVat}` : ''
      setGusMsg({ typ: 'ok', txt: `✓ Dane pobrane z GUS${vatInfo}` })
    } catch (e: any) {
      setGusMsg({ typ: 'err', txt: 'Błąd połączenia z GUS' })
    } finally {
      setGusLoading(false)
    }
  }

  function isImage(url: string) { return /\.(jpg|jpeg|png|gif|webp)$/i.test(url) }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-xl" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        <h2 className="text-base font-medium text-gray-900 mb-4">{title}</h2>
        <form onSubmit={onSubmit} autoComplete="off">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className={labelCls}>Nazwa / imię i nazwisko</label>
              <input value={f.nazwa} onChange={e => setF(p => ({ ...p, nazwa: e.target.value }))}
                placeholder="Jan Kowalski" required className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Typ klienta</label>
              <select value={f.typ} onChange={e => setF(p => ({ ...p, typ: e.target.value }))} className={inputCls}>
                <option value="osoba_fizyczna">Osoba fizyczna</option>
                <option value="firma">Firma</option>
              </select>
            </div>
            {f.typ === 'firma' ? (
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>NIP</label>
                <div className="flex gap-1.5">
                  <input value={f.nip} onChange={e => { setF(p => ({ ...p, nip: e.target.value })); setGusMsg(null) }}
                    placeholder="0000000000" className={inputCls} maxLength={13} />
                  <button type="button" onClick={pobierzZGUS} disabled={gusLoading}
                    title="Pobierz dane firmy z GUS / MF"
                    className="shrink-0 px-2.5 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-1">
                    {gusLoading ? <span className="animate-spin">⟳</span> : '🏛'} GUS
                  </button>
                </div>
                {gusMsg && (
                  <p className={`text-xs px-2 py-1 rounded ${gusMsg.typ === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {gusMsg.txt}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>PESEL</label>
                <input value={f.pesel} onChange={e => setF(p => ({ ...p, pesel: e.target.value }))} placeholder="00000000000" maxLength={11} className={inputCls} />
              </div>
            )}
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className={labelCls}>Adres</label>
              <input value={f.adres} onChange={e => setF(p => ({ ...p, adres: e.target.value }))} placeholder="ul. Przykładowa 1" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Kod pocztowy</label>
              <input value={f.kod_pocztowy} onChange={e => setF(p => ({ ...p, kod_pocztowy: e.target.value }))} placeholder="15-001" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Miasto</label>
              <input value={f.miasto} onChange={e => setF(p => ({ ...p, miasto: e.target.value }))} placeholder="Białystok" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Telefon</label>
              <input value={f.telefon} onChange={e => setF(p => ({ ...p, telefon: e.target.value }))} placeholder="+48 000 000 000" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Email</label>
              <input type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} placeholder="jan@example.pl" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className={labelCls}>Uwagi</label>
              <textarea value={f.uwagi} onChange={e => setF(p => ({ ...p, uwagi: e.target.value }))}
                placeholder="Ważne informacje o kliencie..." rows={2}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none" />
            </div>
          </div>

          <div className="mb-4">
            <label className={labelCls + ' block mb-2'}>Załączniki</label>
            {docs.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {docs.map((url, i) => (
                  <div key={i} className="relative group border border-gray-200 rounded-lg overflow-hidden">
                    {isImage(url) ? <img src={url} alt="" className="w-full h-16 object-cover" /> : (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-16 bg-gray-50 hover:bg-gray-100">
                        <span className="text-lg">📄</span>
                      </a>
                    )}
                    <button type="button" onClick={() => onDeleteDoc(url)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center hover:border-gray-300 transition-colors">
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf" onChange={onUpload} className="hidden" id="klient-file-upload" />
              <label htmlFor="klient-file-upload" className="cursor-pointer">
                <p className="text-xs font-medium text-gray-500">{uploading ? 'Przesyłanie...' : 'Kliknij aby dodać pliki'}</p>
              </label>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
              {saving ? 'Zapisywanie...' : 'Zapisz klienta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===== TYPY IMPORTU =====
type WierszImportu = {
  imie: string; nazwisko: string; kod: string; miasto: string
  adres: string; telefon: string; pesel: string
  uwagi: string
  nazwa: string
}
type DecyzjaDuplikatu = { wiersz: WierszImportu; istniejacy: Klient; akcja: 'polacz' | 'nowy' | 'pominSecond' }

// ===== KOMPONENT IMPORTU =====
function ImportKlientow({ klienci, onSuccess }: { klienci: Klient[]; onSuccess: () => void }) {
  const supabase = createClient()
  const [parsedData, setParsedData] = useState<WierszImportu[]>([])
  const [preview, setPreview] = useState<WierszImportu[]>([])
  const [duplikaty, setDuplikaty] = useState<DecyzjaDuplikatu[]>([])
  const [decyzje, setDecyzje] = useState<Record<string, string>>({}) // nazwa -> id lub 'nowy'
  const [krokImportu, setKrokImportu] = useState<'plik' | 'podglad' | 'duplikaty' | 'wynik'>('plik')
  const [importing, setImporting] = useState(false)
  const [wynikImportu, setWynikImportu] = useState({ nowi: 0, polaczeni: 0, pominieci: 0 })
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setParsedData([]); setPreview([]); setDuplikaty([]); setDecyzje({})
    setKrokImportu('plik'); setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const buf = ev.target?.result as ArrayBuffer
        const wb = XLSX.read(buf)
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false })

        // Szukaj dynamicznie pierwszego wiersza z nagłówkami (ma 'imi' lub 'nazwisko')
        function stripPL(s: string) {
          return s.toLowerCase()
            .replace(/\u0105/g,'a').replace(/\u0107/g,'c').replace(/\u0119/g,'e')
            .replace(/\u0142/g,'l').replace(/\u0144/g,'n').replace(/\u00f3/g,'o')
            .replace(/\u015b/g,'s').replace(/\u017a/g,'z').replace(/\u017c/g,'z')
        }

        let headerIdx = -1
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const r = rows[i] as any[]
          if (!r || r.length === 0) continue
          const found = r.some(v => {
            const s = stripPL(String(v ?? ''))
            return s.includes('imi') || s.includes('nazwisko')
          })
          if (found) { headerIdx = i; break }
        }
        if (headerIdx === -1) {
          setError('Nie znaleziono nagłówków. Upewnij się że plik ma kolumny Imię i Nazwisko.'); return
        }

        const rawHeader = rows[headerIdx] as any[]
        const header = rawHeader.map(h => stripPL(String(h ?? '')))

        const iImie  = header.findIndex(h => h.includes('imi'))
        const iNaz   = header.findIndex(h => h.includes('nazwisko'))
        const iKod   = header.findIndex(h => h.includes('kod'))
        const iMiasto= header.findIndex(h => h.includes('miejscowosc') || h.includes('miasto'))
        const iAdres = header.findIndex(h => h.includes('adres'))
        const iTel   = header.findIndex(h => h.includes('telefon') || h.includes('tel'))
        const iPesel = header.findIndex(h => h.includes('pesel'))
        const iUwagi = header.findIndex(h => h.includes('uwagi'))

        const wyniki: WierszImportu[] = []
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i] as any[]
          if (!row || row.length === 0) continue
          const imieVal = iImie >= 0 ? row[iImie] : null
          const nazVal  = iNaz  >= 0 ? row[iNaz]  : null
          if (!imieVal && !nazVal) continue
          const imie = String(imieVal ?? '').trim()
          const nazwisko = String(nazVal ?? '').trim()
          const nazwa = [imie, nazwisko].filter(Boolean).join(' ')
          if (!nazwa) continue
          wyniki.push({
            imie, nazwisko, nazwa,
            kod: String(row[iKod] ?? '').trim(),
            miasto: String(row[iMiasto] ?? '').trim(),
            adres: String(row[iAdres] ?? '').trim(),
            telefon: String(row[iTel] ?? '').trim(),
            pesel: String(row[iPesel] ?? '').trim(),
            uwagi: String(row[iUwagi] ?? '').trim(),
          })
        }
        setParsedData(wyniki)
        setPreview(wyniki.slice(0, 20))
        setKrokImportu('podglad')
      } catch (ex: any) { setError('Błąd odczytu pliku: ' + ex.message) }
    }
    reader.readAsArrayBuffer(file)
  }

  function sprawdzDuplikaty() {
    const found: DecyzjaDuplikatu[] = []
    const dec: Record<string, string> = {}

    for (const w of parsedData) {
      // Dokładne dopasowanie po nazwie
      const exact = klienci.find(k => norm(k.nazwa) === norm(w.nazwa))
      if (exact) {
        dec[w.nazwa] = exact.id // auto-połącz dokładne
        continue
      }
      // Podobne (>82%)
      let best: Klient | null = null, bestScore = 0
      for (const k of klienci) {
        const s = podobienstwo(w.nazwa, k.nazwa)
        if (s > bestScore) { bestScore = s; best = k }
      }
      if (best && bestScore >= 0.82) {
        found.push({ wiersz: w, istniejacy: best, akcja: 'polacz' })
        dec[w.nazwa] = best.id
      } else {
        dec[w.nazwa] = 'nowy'
      }
    }

    setDuplikaty(found)
    setDecyzje(dec)
    if (found.length > 0) setKrokImportu('duplikaty')
    else doImport(dec)
  }

  async function doImport(dec: Record<string, string>) {
    setImporting(true); setKrokImportu('wynik')
    let nowi = 0, polaczeni = 0, pominieci = 0

    for (const w of parsedData) {
      const akcja = dec[w.nazwa]
      if (!akcja || akcja === 'pominSecond') { pominieci++; continue }

      const payload: any = {
        adres: w.adres || null,
        miasto: w.miasto || null,
        kod_pocztowy: w.kod || null,
        telefon: w.telefon || null,
        pesel: w.pesel || null,
        uwagi: w.uwagi || null,
        aktywny: true,
      }

      if (akcja === 'nowy') {
        await supabase.from('klienci').insert({ ...payload, nazwa: w.nazwa, typ: 'osoba_fizyczna' })
        nowi++
      } else {
        // Połącz — aktualizuj tylko puste pola
        const istn = klienci.find(k => k.id === akcja)
        if (!istn) continue
        const update: any = {}
        if (!istn.adres && w.adres) update.adres = w.adres
        if (!istn.miasto && w.miasto) update.miasto = w.miasto
        if (!istn.kod_pocztowy && w.kod) update.kod_pocztowy = w.kod
        if (!istn.telefon && w.telefon) update.telefon = w.telefon
        if (!istn.pesel && w.pesel) update.pesel = w.pesel
        if (!istn.uwagi && w.uwagi) update.uwagi = w.uwagi
        if (Object.keys(update).length > 0)
          await supabase.from('klienci').update(update).eq('id', akcja)
        polaczeni++
      }
    }

    setWynikImportu({ nowi, polaczeni, pominieci })
    setImporting(false)
    onSuccess()
  }

  function updateDecyzja(nazwa: string, akcja: string) {
    setDecyzje(prev => ({ ...prev, [nazwa]: akcja }))
    setDuplikaty(prev => prev.map(d =>
      d.wiersz.nazwa === nazwa ? { ...d, akcja: akcja === 'nowy' ? 'nowy' : akcja === 'pominSecond' ? 'pominSecond' : 'polacz' } : d
    ))
  }

  return (
    <div>
      {/* Krok 1 — wybór pliku */}
      {krokImportu === 'plik' && (
        <div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-xs text-blue-800">
            <p className="font-medium mb-1">Format pliku Excel</p>
            <p>Nagłówki w <b>wierszu 2</b>: Imię, Nazwisko, kod pocztowy, Miejscowość, Adres Zamieszkania, Numer Telefonu, PESEL, Uwagi</p>
            <p className="mt-1 text-blue-600">System automatycznie wykrywa duplikatów i pyta o decyzję.</p>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-3">{error}</p>}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-300 transition-colors">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" id="import-klient-file" />
            <label htmlFor="import-klient-file" className="cursor-pointer">
              <div className="text-4xl mb-2">📥</div>
              <p className="text-sm font-medium text-gray-600">Kliknij aby wybrać plik .xlsx</p>
              <p className="text-xs text-gray-400 mt-1">Plik z listą klientów (.xlsx)</p>
            </label>
          </div>
        </div>
      )}

      {/* Krok 2 — podgląd */}
      {krokImportu === 'podglad' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-700">Znaleziono <strong>{parsedData.length}</strong> klientów do zaimportowania.</p>
            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">↺ Zacznij od nowa</button>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Imię i nazwisko', 'Kod', 'Miasto', 'Adres', 'Telefon', 'Uwagi'].map(h =>
                      <th key={h} className="text-left py-2 px-3 text-gray-400 font-medium whitespace-nowrap">{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-1.5 px-3 font-medium">{r.nazwa}</td>
                      <td className="py-1.5 px-3 text-gray-500">{r.kod || '—'}</td>
                      <td className="py-1.5 px-3">{r.miasto || '—'}</td>
                      <td className="py-1.5 px-3 text-gray-500 max-w-[120px] truncate">{r.adres || '—'}</td>
                      <td className="py-1.5 px-3">{r.telefon || '—'}</td>
                      <td className="py-1.5 px-3 text-gray-500 max-w-[100px] truncate">{r.uwagi || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedData.length > 20 && <p className="text-xs text-gray-400 text-center py-2">...i {parsedData.length - 20} więcej</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={reset} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
            <button onClick={sprawdzDuplikaty} className="px-6 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700">
              🔍 Sprawdź duplikaty i kontynuuj →
            </button>
          </div>
        </div>
      )}

      {/* Krok 3 — duplikaty */}
      {krokImportu === 'duplikaty' && (
        <div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-medium text-yellow-800">Wykryto {duplikaty.length} potencjalnych duplikatów. Zdecyduj co zrobić z każdym.</p>
          </div>
          <div className="space-y-3 mb-5" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            {duplikaty.map((d, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-xs text-blue-600 font-medium mb-0.5">📥 Importowany</p>
                    <p className="text-sm font-medium text-gray-900">{d.wiersz.nazwa}</p>
                    <p className="text-xs text-gray-500">{[d.wiersz.kod, d.wiersz.miasto].filter(Boolean).join(' ')}</p>
                    <p className="text-xs text-gray-500">{d.wiersz.adres}</p>
                    <p className="text-xs text-gray-500">{d.wiersz.telefon}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500 font-medium mb-0.5">📋 W bazie</p>
                    <p className="text-sm font-medium text-gray-900">{d.istniejacy.nazwa}</p>
                    <p className="text-xs text-gray-500">{[d.istniejacy.kod_pocztowy, d.istniejacy.miasto].filter(Boolean).join(' ')}</p>
                    <p className="text-xs text-gray-500">{d.istniejacy.adres}</p>
                    <p className="text-xs text-gray-500">{d.istniejacy.telefon}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateDecyzja(d.wiersz.nazwa, d.istniejacy.id)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${decyzje[d.wiersz.nazwa] === d.istniejacy.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                    🔗 Uzupełnij istniejącego
                  </button>
                  <button onClick={() => updateDecyzja(d.wiersz.nazwa, 'nowy')}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${decyzje[d.wiersz.nazwa] === 'nowy' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                    ➕ Utwórz nowego
                  </button>
                  <button onClick={() => updateDecyzja(d.wiersz.nazwa, 'pominSecond')}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${decyzje[d.wiersz.nazwa] === 'pominSecond' ? 'bg-yellow-500 text-white border-yellow-500' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                    ⏭ Pomiń
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-3 border-t border-gray-100">
            <button onClick={() => setKrokImportu('podglad')} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">← Wróć</button>
            <button onClick={() => doImport(decyzje)} disabled={importing}
              className="px-6 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
              {importing ? 'Importowanie...' : `✓ Zatwierdź i importuj wszystkich`}
            </button>
          </div>
        </div>
      )}

      {/* Krok 4 — wynik */}
      {krokImportu === 'wynik' && (
        <div className="text-center py-6">
          {importing ? (
            <div>
              <div className="text-3xl mb-3">⏳</div>
              <p className="text-sm text-gray-600">Importowanie...</p>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-3">✅</div>
              <p className="text-base font-medium text-gray-900 mb-4">Import zakończony!</p>
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-5">
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xl font-bold text-green-700">{wynikImportu.nowi}</p>
                  <p className="text-xs text-green-600">Nowych klientów</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xl font-bold text-blue-700">{wynikImportu.polaczeni}</p>
                  <p className="text-xs text-blue-600">Uzupełnionych</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xl font-bold text-gray-600">{wynikImportu.pominieci}</p>
                  <p className="text-xs text-gray-500">Pominiętych</p>
                </div>
              </div>
              <button onClick={reset} className="px-6 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                Importuj kolejny plik
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ===== GŁÓWNY KOMPONENT =====
export default function KlienciPage() {
  const supabase = createClient()
  const [klienci, setKlienci] = useState<Klient[]>([])
  const [ostatnie, setOstatnie] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formDocs, setFormDocs] = useState<string[]>([])
  const [formUploading, setFormUploading] = useState(false)
  const formFileRef = useRef<HTMLInputElement>(null)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [editDocs, setEditDocs] = useState<string[]>([])
  const [editUploading, setEditUploading] = useState(false)
  const editFileRef = useRef<HTMLInputElement>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteNazwa, setDeleteNazwa] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [filterTyp, setFilterTyp] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'lista' | 'import'>('lista')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: kl }, { data: sp }] = await Promise.all([
      supabase.from('klienci').select('*').order('nazwa'),
      supabase.from('sprzedaz').select('klient_id, data_sprzedazy').order('data_sprzedazy', { ascending: false }),
    ])
    if (kl) setKlienci(kl)
    if (sp) {
      const map: Record<string, string> = {}
      sp.forEach((s: any) => { if (!map[s.klient_id]) map[s.klient_id] = s.data_sprzedazy })
      setOstatnie(map)
    }
    setLoading(false)
  }

  async function uploadDocs(
    files: FileList, folder: string, existing: string[],
    setDocs: (d: string[]) => void,
    setUploading: (b: boolean) => void,
    ref: React.RefObject<HTMLInputElement | null>
  ) {
    setUploading(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `klienci/${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('dokumenty').upload(path, file)
      if (!error) { const { data } = supabase.storage.from('dokumenty').getPublicUrl(path); urls.push(data.publicUrl) }
    }
    setDocs([...existing, ...urls])
    setUploading(false)
    if (ref.current) ref.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const { error } = await supabase.from('klienci').insert({
      nazwa: form.nazwa.trim(), typ: form.typ,
      nip: form.typ === 'firma' ? (form.nip.trim() || null) : null,
      pesel: form.typ === 'osoba_fizyczna' ? (form.pesel.trim() || null) : null,
      adres: form.adres.trim() || null, miasto: form.miasto.trim() || null,
      kod_pocztowy: form.kod_pocztowy.trim() || null, telefon: form.telefon.trim() || null,
      email: form.email.trim() || null, uwagi: form.uwagi.trim() || null,
      dokumenty: formDocs.length > 0 ? formDocs : null,
    })
    if (error) { setError('Błąd: ' + error.message); setSaving(false); return }
    setSuccess('Klient dodany!'); setForm(emptyForm); setFormDocs([]); setShowForm(false)
    fetchAll(); setTimeout(() => setSuccess(''), 3000); setSaving(false)
  }

  function openEdit(k: Klient) {
    setEditId(k.id); setEditDocs(k.dokumenty ?? [])
    setEditForm({
      nazwa: k.nazwa, typ: k.typ,
      nip: k.nip ?? '', pesel: k.pesel ?? '',
      adres: k.adres ?? '', miasto: k.miasto ?? '',
      kod_pocztowy: k.kod_pocztowy ?? '', telefon: k.telefon ?? '',
      email: k.email ?? '', uwagi: k.uwagi ?? '',
    })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editId) return; setEditSaving(true)
    await supabase.from('klienci').update({
      nazwa: editForm.nazwa.trim(), typ: editForm.typ,
      nip: editForm.typ === 'firma' ? (editForm.nip.trim() || null) : null,
      pesel: editForm.typ === 'osoba_fizyczna' ? (editForm.pesel.trim() || null) : null,
      adres: editForm.adres.trim() || null, miasto: editForm.miasto.trim() || null,
      kod_pocztowy: editForm.kod_pocztowy.trim() || null, telefon: editForm.telefon.trim() || null,
      email: editForm.email.trim() || null, uwagi: editForm.uwagi.trim() || null,
      dokumenty: editDocs.length > 0 ? editDocs : null,
    }).eq('id', editId)
    setEditId(null); fetchAll(); setEditSaving(false)
  }

  async function handleToggleAktywny(k: Klient) {
    await supabase.from('klienci').update({ aktywny: !k.aktywny }).eq('id', k.id); fetchAll()
  }

  async function handleDelete() {
    if (!deleteId) return; setDeleting(true)
    const { error } = await supabase.from('klienci').delete().eq('id', deleteId)
    if (error) setError('Nie można usunąć — klient ma powiązaną sprzedaż.')
    setDeleteId(null); fetchAll(); setDeleting(false)
  }

  const filtered = klienci.filter(k => {
    const q = search.toLowerCase()
    return (
      k.nazwa.toLowerCase().includes(q) ||
      (k.miasto ?? '').toLowerCase().includes(q) ||
      (k.telefon ?? '').includes(q) ||
      (k.nip ?? '').includes(q) ||
      (k.pesel ?? '').includes(q) ||
      (k.uwagi ?? '').toLowerCase().includes(q)
    ) && (filterTyp ? k.typ === filterTyp : true)
  })

  const detail = klienci.find(k => k.id === detailId)

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        {/* Nagłówek */}
        <div className="module-header flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-medium text-gray-900">Klienci</h1>
            <p className="text-sm text-gray-500 mt-0.5">Baza klientów · {klienci.length} łącznie</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setForm(emptyForm); setFormDocs([]); setShowForm(true) }}
              className="text-sm bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700 transition-colors">
              + Nowy klient
            </button>
          </div>
        </div>

        {success && <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mb-4">{success}</p>}
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-4">{error}</p>}

        {/* Zakładki */}
        <div className="flex gap-1 mb-5 border-b border-gray-200">
          <button onClick={() => setActiveTab('lista')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'lista' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Lista klientów
          </button>
          <button onClick={() => setActiveTab('import')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'import' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            📥 Import z Excel
          </button>
        </div>

        {/* Zakładka Import */}
        {activeTab === 'import' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Import klientów z pliku Excel</h2>
            <ImportKlientow klienci={klienci} onSuccess={() => { fetchAll(); setSuccess('Import zakończony!'); setTimeout(() => setSuccess(''), 4000) }} />
          </div>
        )}

        {/* Zakładka Lista */}
        {activeTab === 'lista' && (
          <>
            <div className="flex gap-3 mb-4 flex-wrap">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="🔍  Szukaj po nazwie, mieście, NIP, PESEL, telefonie, uwagach..."
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-48" />
              <select value={filterTyp} onChange={e => setFilterTyp(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Wszyscy</option>
                <option value="osoba_fizyczna">Osoby fizyczne</option>
                <option value="firma">Firmy</option>
              </select>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                {loading ? (
                  <p className="text-sm text-gray-400 py-8 text-center">Ładowanie...</p>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">
                    {klienci.length === 0 ? 'Brak klientów.' : 'Brak wyników.'}
                  </p>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Nazwa</th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Miasto</th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Telefon</th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Ostatni zakup</th>
                        <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Status</th>
                        <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(k => (
                        <tr key={k.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!k.aktywny ? 'opacity-50' : ''}`}>
                          <td className="py-3 px-4">
                            <button onClick={() => setDetailId(k.id)} className="font-medium text-gray-900 hover:text-blue-700 transition-colors text-left">
                              {k.nazwa}
                            </button>
                            {k.nip && <div className="text-xs text-gray-400">NIP: {k.nip}</div>}
                            {k.pesel && <div className="text-xs text-gray-400">PESEL: {k.pesel}</div>}
                            {k.uwagi && <div className="text-xs text-amber-600 mt-0.5 max-w-[180px] truncate" title={k.uwagi}>📝 {k.uwagi}</div>}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {k.miasto || <span className="text-gray-300">—</span>}
                            {k.kod_pocztowy && <div className="text-xs text-gray-400">{k.kod_pocztowy}</div>}
                          </td>
                          <td className="py-3 px-4 text-gray-600">{k.telefon || <span className="text-gray-300">—</span>}</td>
                          <td className="py-3 px-4"><OstatniKupilBadge data={ostatnie[k.id] ?? null} /></td>
                          <td className="py-3 px-4 text-center">
                            <button onClick={() => handleToggleAktywny(k)}
                              className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${k.aktywny ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                              {k.aktywny ? 'Aktywny' : 'Nieaktywny'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => setDetailId(k.id)} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-500">Szczeg.</button>
                              <button onClick={() => openEdit(k)} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-gray-500">Edytuj</button>
                              <button onClick={() => { setDeleteId(k.id); setDeleteNazwa(k.nazwa) }} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-gray-500">Usuń</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Formularze modalne */}
      {showForm && (
        <KlientForm f={form} setF={setForm} onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setFormDocs([]) }}
          saving={saving} title="Nowy klient" docs={formDocs}
          onUpload={e => { if (e.target.files) uploadDocs(e.target.files, 'nowy_' + Date.now(), formDocs, setFormDocs, setFormUploading, formFileRef) }}
          onDeleteDoc={url => setFormDocs(formDocs.filter(d => d !== url))}
          uploading={formUploading} fileRef={formFileRef} />
      )}

      {editId && (
        <KlientForm f={editForm} setF={setEditForm} onSubmit={handleEdit}
          onCancel={() => setEditId(null)}
          saving={editSaving} title="Edytuj klienta" docs={editDocs}
          onUpload={e => { if (e.target.files) uploadDocs(e.target.files, editId, editDocs, setEditDocs, setEditUploading, editFileRef) }}
          onDeleteDoc={url => setEditDocs(editDocs.filter(d => d !== url))}
          uploading={editUploading} fileRef={editFileRef} />
      )}

      {/* Modal szczegółów */}
      {detail && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-medium text-gray-900">{detail.nazwa}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${detail.typ === 'firma' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {detail.typ === 'firma' ? 'Firma' : 'Osoba fizyczna'}
                </span>
              </div>
              <button onClick={() => setDetailId(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-500">Ostatni zakup</span><OstatniKupilBadge data={ostatnie[detail.id] ?? null} /></div>
              {detail.nip && <div className="flex justify-between"><span className="text-gray-500">NIP</span><span>{detail.nip}</span></div>}
              {detail.pesel && <div className="flex justify-between"><span className="text-gray-500">PESEL</span><span>{detail.pesel}</span></div>}
              {detail.adres && <div className="flex justify-between"><span className="text-gray-500">Adres</span><span>{detail.adres}</span></div>}
              {(detail.kod_pocztowy || detail.miasto) && <div className="flex justify-between"><span className="text-gray-500">Miasto</span><span>{[detail.kod_pocztowy, detail.miasto].filter(Boolean).join(' ')}</span></div>}
              {detail.telefon && <div className="flex justify-between"><span className="text-gray-500">Telefon</span><a href={`tel:${detail.telefon}`} className="text-blue-700">{detail.telefon}</a></div>}
              {detail.email && <div className="flex justify-between"><span className="text-gray-500">Email</span><a href={`mailto:${detail.email}`} className="text-blue-700">{detail.email}</a></div>}
              {detail.uwagi && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-gray-500 mb-1 text-xs font-medium uppercase tracking-wide">Uwagi</p>
                  <p className="text-gray-800 bg-amber-50 border border-amber-100 rounded-lg p-2 text-xs">{detail.uwagi}</p>
                </div>
              )}
              {detail.dokumenty && detail.dokumenty.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-gray-500 mb-2 text-xs font-medium uppercase tracking-wide">Załączniki ({detail.dokumenty.length})</p>
                  <div className="grid grid-cols-4 gap-2">
                    {detail.dokumenty.map((url, i) => (
                      /\.(jpg|jpeg|png|webp)$/i.test(url)
                        ? <img key={i} src={url} alt="" className="w-full h-14 object-cover rounded-lg border border-gray-200" />
                        : <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-14 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-100">📄 PDF</a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setDetailId(null); openEdit(detail) }} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Edytuj</button>
              <a href="/sprzedaz" className="flex-1 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 text-center">Dodaj sprzedaż →</a>
            </div>
          </div>
        </div>
      )}

      {/* Modal usuwania */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-900 mb-2">Usuń klienta</h2>
            <p className="text-sm text-gray-500 mb-5">Czy na pewno chcesz usunąć <span className="font-medium">{deleteNazwa}</span>?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Usuwanie...' : 'Tak, usuń'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Pływający przycisk czatu */}
      <CzatPanel modul="klienci" compact />

    </div>
  )
}
