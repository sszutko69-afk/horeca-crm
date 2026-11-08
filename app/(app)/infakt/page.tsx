'use client'
import { useEffect, useState } from 'react'

const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

type Tab = 'faktury' | 'klienci' | 'koszty' | 'produkty' | 'budzet'

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'
}

export default function InFaktPage() {
  const [apiKey, setApiKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [testing, setTesting] = useState(false)
  const [tab, setTab] = useState<Tab>('faktury')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')

  const [faktury, setFaktury] = useState<any[]>([])
  const [fakturyTotal, setFakturyTotal] = useState(0)
  const [fakturyOffset, setFakturyOffset] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQ, setSearchQ] = useState('')

  const [klienci, setKlienci] = useState<any[]>([])
  const [klienciTotal, setKlienciTotal] = useState(0)
  const [koszty, setKoszty] = useState<any[]>([])
  const [kosztyTotal, setKosztyTotal] = useState(0)
  const [produkty, setProdukty] = useState<any[]>([])

  // Cache info
  const [cacheInfoF, setCacheInfoF] = useState('')
  const [cacheInfoK, setCacheInfoK] = useState('')
  const [syncing, setSyncing] = useState(false)

  const now = new Date()
  const [budzetRok, setBudzetRok] = useState(now.getFullYear())
  const [budzetMiesiac, setBudzetMiesiac] = useState(now.getMonth() + 1)
  const [budzetData, setBudzetData] = useState<any>(null)

  useEffect(() => {
    const saved = localStorage.getItem('infakt_api_key')
    if (saved) { setApiKey(saved); setKeyInput(saved); testConnection(saved) }

    // Załaduj faktury z cache
    try {
      const cf = localStorage.getItem('infakt_faktury_cache')
      if (cf) {
        const parsed = JSON.parse(cf)
        if (parsed.faktury?.length) {
          setFaktury(parsed.faktury)
          setFakturyTotal(parsed.faktury.length)
          setCacheInfoF(`📦 ${parsed.faktury.length} faktur z cache · ostatnia sync: ${parsed.syncDate ?? '?'}`)
        }
      }
      const ck = localStorage.getItem('infakt_koszty_cache')
      if (ck) {
        const parsed = JSON.parse(ck)
        if (parsed.koszty?.length) {
          setKoszty(parsed.koszty)
          setKosztyTotal(parsed.koszty.length)
          setCacheInfoK(`📦 ${parsed.koszty.length} kosztów z cache · ostatnia sync: ${parsed.syncDate ?? '?'}`)
        }
      }
    } catch {}
  }, [])

  async function apiFetch(action: string, extra?: Record<string, string>) {
    const url = new URL('/api/infakt/faktury', window.location.origin)
    url.searchParams.set('action', action)
    if (extra) Object.entries(extra).forEach(([k, v]) => { if (v) url.searchParams.set(k, v) })
    const res = await fetch(url.toString(), { headers: { 'X-inFakt-ApiKey': apiKey } })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
    return data
  }

  async function testConnection(key?: string) {
    const k = key ?? apiKey
    if (!k) return
    setTesting(true); setErr('')
    try {
      const url = new URL('/api/infakt/faktury', window.location.origin)
      url.searchParams.set('action', 'test')
      const res = await fetch(url.toString(), { headers: { 'X-inFakt-ApiKey': k } })
      const data = await res.json()
      if (data.ok) {
        setConnected(true); setApiKey(k)
        localStorage.setItem('infakt_api_key', k)
        setInfo(`Połączono · ${data.total_faktur} faktur w systemie`)
      } else throw new Error(data.error ?? 'Błąd połączenia')
    } catch (e: any) { setErr('Błąd: ' + e.message); setConnected(false) }
    setTesting(false)
  }

  function disconnect() {
    setApiKey(''); setKeyInput(''); setConnected(false)
    localStorage.removeItem('infakt_api_key')
    setFaktury([])
  }

  async function loadFaktury(offset = 0) {
    setLoading(true); setErr('')
    try {
      const data = await apiFetch('faktury', { limit: '100', offset: String(offset), date_from: dateFrom, date_to: dateTo, q: searchQ })
      setFaktury(data.faktury ?? []); setFakturyTotal(data.total ?? 0); setFakturyOffset(offset)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }

  function saveFakturyCache(newFaktury: any[], mergeWithExisting = false) {
    try {
      let toSave = newFaktury
      if (mergeWithExisting) {
        const existing: any[] = JSON.parse(localStorage.getItem('infakt_faktury_cache') ?? '{"faktury":[]}').faktury ?? []
        const existingIds = new Set(existing.map((f: any) => f.uuid ?? f.id))
        const onlyNew = newFaktury.filter(f => !existingIds.has(f.uuid ?? f.id))
        toSave = [...onlyNew, ...existing]
      }
      const syncDate = new Date().toLocaleString('pl-PL')
      localStorage.setItem('infakt_faktury_cache', JSON.stringify({ faktury: toSave, syncDate }))
      setCacheInfoF(`📦 ${toSave.length} faktur w cache · sync: ${syncDate}`)
      return toSave
    } catch { return newFaktury }
  }

  function saveKosztyCache(newKoszty: any[], mergeWithExisting = false) {
    try {
      let toSave = newKoszty
      if (mergeWithExisting) {
        const existing: any[] = JSON.parse(localStorage.getItem('infakt_koszty_cache') ?? '{"koszty":[]}').koszty ?? []
        const existingIds = new Set(existing.map((k: any) => k.uuid ?? k.id))
        const onlyNew = newKoszty.filter(k => !existingIds.has(k.uuid ?? k.id))
        toSave = [...onlyNew, ...existing]
      }
      const syncDate = new Date().toLocaleString('pl-PL')
      localStorage.setItem('infakt_koszty_cache', JSON.stringify({ koszty: toSave, syncDate }))
      setCacheInfoK(`📦 ${toSave.length} kosztów w cache · sync: ${syncDate}`)
      return toSave
    } catch { return newKoszty }
  }

  async function loadAllFaktury() {
    setLoading(true); setErr('')
    try {
      const first = await apiFetch('faktury', { limit: '100', offset: '0', date_from: dateFrom, date_to: dateTo, q: searchQ })
      const total = first.total ?? 0
      let all: any[] = first.faktury ?? []
      let offset = 100
      while (offset < total && offset < 2000) {
        const page = await apiFetch('faktury', { limit: '100', offset: String(offset), date_from: dateFrom, date_to: dateTo, q: searchQ })
        all = [...all, ...(page.faktury ?? [])]
        offset += 100
      }
      const saved = saveFakturyCache(all)
      setFaktury(saved); setFakturyTotal(saved.length); setFakturyOffset(0)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }

  // Sync przyrostowy — pobiera tylko od ostatniej daty w cache i merguje
  async function syncFaktury() {
    setSyncing(true); setErr('')
    try {
      const cached: any[] = JSON.parse(localStorage.getItem('infakt_faktury_cache') ?? '{"faktury":[]}').faktury ?? []
      // Znajdź najnowszą datę w cache
      let syncFrom = ''
      if (cached.length > 0) {
        const dates = cached.map((f: any) => f.data_wystawienia ?? '').filter(Boolean).sort()
        if (dates.length) {
          const newestDate = new Date(dates[dates.length - 1])
          newestDate.setDate(newestDate.getDate() - 3) // 3 dni wstecz dla bezpieczeństwa
          syncFrom = newestDate.toISOString().split('T')[0]
        }
      }
      const first = await apiFetch('faktury', { limit: '100', offset: '0', date_from: syncFrom, date_to: '' })
      const total = first.total ?? 0
      let newDocs: any[] = first.faktury ?? []
      let offset = 100
      while (offset < total && offset < 500) {
        const page = await apiFetch('faktury', { limit: '100', offset: String(offset), date_from: syncFrom })
        newDocs = [...newDocs, ...(page.faktury ?? [])]
        offset += 100
      }
      const merged = saveFakturyCache(newDocs, true)
      setFaktury(merged); setFakturyTotal(merged.length)
      setInfo(`✓ Zsynchronizowano · ${merged.length} faktur w bazie`)
    } catch (e: any) { setErr(e.message) }
    setSyncing(false)
  }

  async function syncKoszty() {
    setSyncing(true); setErr('')
    try {
      const cached: any[] = JSON.parse(localStorage.getItem('infakt_koszty_cache') ?? '{"koszty":[]}').koszty ?? []
      let syncFrom = ''
      if (cached.length > 0) {
        const dates = cached.map((k: any) => k.data ?? '').filter(Boolean).sort()
        if (dates.length) {
          const newestDate = new Date(dates[dates.length - 1])
          newestDate.setDate(newestDate.getDate() - 3)
          syncFrom = newestDate.toISOString().split('T')[0]
        }
      }
      const first = await apiFetch('koszty', { limit: '100', offset: '0', date_from: syncFrom })
      const total = first.total ?? 0
      let newDocs: any[] = first.koszty ?? []
      let offset = 100
      while (offset < total && offset < 500) {
        const page = await apiFetch('koszty', { limit: '100', offset: String(offset), date_from: syncFrom })
        newDocs = [...newDocs, ...(page.koszty ?? [])]
        offset += 100
      }
      const merged = saveKosztyCache(newDocs, true)
      setKoszty(merged); setKosztyTotal(merged.length)
    } catch (e: any) { setErr(e.message) }
    setSyncing(false)
  }

  function clearFakturyCache() {
    localStorage.removeItem('infakt_faktury_cache')
    setFaktury([]); setFakturyTotal(0); setCacheInfoF('')
  }

  function clearKosztyCache() {
    localStorage.removeItem('infakt_koszty_cache')
    setKoszty([]); setKosztyTotal(0); setCacheInfoK('')
  }

  async function loadAllKoszty() {
    setLoading(true); setErr('')
    try {
      const first = await apiFetch('koszty', { limit: '100', offset: '0', date_from: dateFrom, date_to: dateTo })
      const total = first.total ?? 0
      let all: any[] = first.koszty ?? []
      let offset = 100
      while (offset < total && offset < 2000) {
        const page = await apiFetch('koszty', { limit: '100', offset: String(offset), date_from: dateFrom, date_to: dateTo })
        all = [...all, ...(page.koszty ?? [])]
        offset += 100
      }
      const saved = saveKosztyCache(all)
      setKoszty(saved); setKosztyTotal(saved.length)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }

  async function loadKlienci() {
    setLoading(true); setErr('')
    try {
      const data = await apiFetch('klienci', { limit: '100', q: searchQ })
      setKlienci(data.klienci ?? []); setKlienciTotal(data.total ?? 0)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }

  async function loadKoszty() {
    setLoading(true); setErr('')
    try {
      const data = await apiFetch('koszty', { limit: '50', offset: String(fakturyOffset), date_from: dateFrom, date_to: dateTo })
      setKoszty(data.koszty ?? []); setKosztyTotal(data.total ?? 0)
    } catch (e: any) { setErr((e as any).message) }
    setLoading(false)
  }

  async function loadProdukty() {
    setLoading(true); setErr('')
    try {
      const data = await apiFetch('produkty', { limit: '100', q: searchQ })
      setProdukty(data.produkty ?? [])
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }

  // Import kosztu do modułu Budżet
  async function importKosztDoBudzetu(k: any) {
    try {
      const { createClient } = await import('@/lib/supabase')
      const sb = createClient()
      // Znajdź kategorię budżetu
      const { data: kats } = await sb.from('budzet_kategorie').select('id, nazwa').eq('typ', 'koszt')
      // Dopasuj kategorię po nazwie
      const katMap: Record<string, string> = {
        'Wydatki przedsiębiorcy': 'Usługi zewnętrzne',
        'Paliwo': 'Paliwo i transport',
        'Telekomunikacja': 'Usługi zewnętrzne',
        'Wynagrodzenia': 'Wynagrodzenia brutto',
        'Media': 'Najem i media',
        'Ubezpieczenia': 'Ubezpieczenia',
      }
      const katNazwa = katMap[k.kategoria] ?? k.kategoria
      const kat = (kats ?? []).find((x: any) => x.nazwa === katNazwa || x.nazwa.includes(katNazwa.split(' ')[0]))
      const date = new Date(k.data)
      await sb.from('budzet_realizacja').insert({
        rok: date.getFullYear(),
        miesiac: date.getMonth() + 1,
        kategoria_id: kat?.id ?? null,
        kwota: k.kwota_brutto,
        opis: `${k.numer ? k.numer + ' · ' : ''}${k.dostawca || k.nazwa}`,
        zrodlo: 'infakt',
      })
      alert(`✓ Dodano do budżetu: ${k.dostawca || k.nazwa} — ${fmt(k.kwota_brutto)}`)
    } catch(e: any) { alert('Błąd: ' + e.message) }
  }

  // Upload dokumentu do inFakt
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File|null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')

  async function uploadDokument() {
    if (!uploadFile) return
    setUploadLoading(true); setUploadMsg('')
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = e => res((e.target?.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(uploadFile)
      })
      const { createClient } = await import('@/lib/supabase')
      const sb = createClient()
      const fileName = `infakt_${Date.now()}_${uploadFile.name}`
      const { data: up, error } = await sb.storage.from('dokumenty').upload(fileName, uploadFile, { contentType: uploadFile.type })
      if (error) throw error
      const { data: { publicUrl } } = sb.storage.from('dokumenty').getPublicUrl(fileName)
      setUploadMsg(`✓ Plik zapisany: ${publicUrl}`)
      setUploadFile(null)
    } catch(e: any) { setUploadMsg('Błąd: ' + e.message) }
    setUploadLoading(false)
  }

  async function loadBudzet() {
    setLoading(true); setErr('')
    try {
      const data = await apiFetch('przychody_miesiac', { rok: String(budzetRok), miesiac: String(budzetMiesiac) })
      setBudzetData(data)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }

  async function importKlientow() {
    setLoading(true)
    try {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const data = await apiFetch('klienci', { limit: '200' })
      let dodano = 0, aktualizowano = 0
      for (const k of data.klienci ?? []) {
        const { data: ex } = await supabase.from('klienci').select('id')
          .ilike('nip', k.nip || 'BRAK').maybeSingle()
        if (ex) {
          await supabase.from('klienci').update({ nazwa: k.nazwa, email: k.email, telefon: k.telefon }).eq('id', ex.id)
          aktualizowano++
        } else {
          await supabase.from('klienci').insert({
            nazwa: k.nazwa, nip: k.nip, email: k.email, telefon: k.telefon,
            miasto: k.miasto, kod_pocztowy: k.kod, ulica: k.ulica, aktywny: true, typ: 'firma',
          })
          dodano++
        }
      }
      alert(`Import: ${dodano} nowych, ${aktualizowano} zaktualizowanych`)
    } catch (e: any) { alert('Błąd: ' + (e as any).message) }
    setLoading(false)
  }

  const MIESIACE = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']
  const TABS: [Tab, string][] = [['faktury','🧾 Faktury'],['klienci','👥 Klienci'],['koszty','📉 Koszty'],['produkty','📦 Produkty'],['budzet','💰 Budżet']]

  if (!connected) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 w-full max-w-md shadow-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🧾</div>
          <h1 className="text-xl font-semibold text-gray-900">Księgowość</h1>
          <p className="text-sm text-gray-500 mt-1">Integracja z Twoim systemem księgowym</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Klucz API systemu księgowego *</label>
            <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && testConnection(keyInput)}
              placeholder="Klucz API → Ustawienia konta → API" className={inp} />
            <p className="text-xs text-gray-400 mt-1">Ustawienia konta → API → Wygeneruj klucz API</p>
          </div>
          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
          <button onClick={() => testConnection(keyInput)} disabled={!keyInput || testing}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm">
            {testing ? '⏳ Sprawdzam połączenie...' : '🔗 Połącz z systemem księgowym'}
          </button>
        </div>
        <div className="mt-5 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 space-y-1">
          <p className="font-semibold">API systemu księgowego — dostępne dane:</p>
          <p>• Faktury przychodowe (lista, filtrowanie po datach)</p>
          <p>• Klienci — z możliwością importu do GazCRM</p>
          <p>• Faktury kosztowe</p>
          <p>• Produkty i usługi cennikowe</p>
          <p>• Przychody miesięczne do modułu Budżet</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🧾</div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Księgowość</h1>
              <p className="text-xs text-green-600">✓ Połączono · {info}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setShowUpload(!showUpload)} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">📎 Dodaj dokument</button>
            <button onClick={disconnect} className="text-xs text-gray-400 hover:text-red-600 border border-gray-200 px-3 py-1.5 rounded-lg">Odłącz</button>
          </div>
          {showUpload && (
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl flex gap-3 items-center flex-wrap">
              <label className="flex-1 min-w-48 text-xs border-2 border-dashed border-gray-300 rounded-lg p-2 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50">
                {uploadFile ? uploadFile.name : '📎 Wybierz PDF lub JPG'}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={e => { if(e.target.files?.[0]) setUploadFile(e.target.files[0]) }} />
              </label>
              <button onClick={uploadDokument} disabled={!uploadFile||uploadLoading}
                className="text-xs bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {uploadLoading?'⏳ Wysyłam...':'⬆ Zapisz'}
              </button>
              {uploadMsg && <p className={`text-xs ${uploadMsg.startsWith('✓')?'text-green-600':'text-red-600'}`}>{uploadMsg}</p>}
            </div>
          )}
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto pb-0.5">
          {TABS.map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${tab===t?'bg-blue-600 text-white':'text-gray-600 hover:bg-gray-100'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto">
        {err && <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">⚠ {err}</div>}

        {tab === 'faktury' && (
          <div>
            {cacheInfoF && (
              <div className="mb-3 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-800 flex-wrap">
                <span>{cacheInfoF}</span>
                <button onClick={syncFaktury} disabled={syncing||loading}
                  className="ml-auto bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium whitespace-nowrap">
                  {syncing ? '⏳ Syncuję...' : '🔄 Synchronizuj (tylko nowe)'}
                </button>
                <button onClick={clearFakturyCache} className="text-amber-600 hover:text-red-600 border border-amber-300 px-2 py-1.5 rounded-lg">🗑 Wyczyść cache</button>
              </div>
            )}
            <div className="flex gap-2 mb-4 flex-wrap items-end">
              <div><label className="text-xs text-gray-500 block mb-1">Data od</label>
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"/></div>
              <div><label className="text-xs text-gray-500 block mb-1">Data do</label>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"/></div>
              <div><label className="text-xs text-gray-500 block mb-1">Nr faktury</label>
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Szukaj..." className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white w-36"/></div>
              <button onClick={()=>loadFaktury(0)} disabled={loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading?'⏳':'🔍 Pobierz (100)'}</button>
              <button onClick={loadAllFaktury} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {loading?'⏳':'📥 Pobierz wszystkie i zapisz'}</button>
            </div>
            {faktury.length > 0 && <>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 mb-3 flex gap-6 text-sm flex-wrap items-center">
                <span className="text-blue-700">Załadowano: <strong>{faktury.length}</strong></span>
                <span className="text-green-700">Suma brutto: <strong>{fmt(faktury.reduce((a,f)=>a+f.brutto,0))}</strong></span>
                <span className="text-blue-600">Opłacone: <strong>{faktury.filter(f=>f.oplacona).length}/{faktury.length}</strong></span>
                {!cacheInfoF && (
                  <button onClick={loadAllFaktury} disabled={loading} className="ml-auto text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700">
                    📥 Załaduj wszystkie i zapisz
                  </button>
                )}
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>{['Nr faktury','Data','Klient','NIP','Netto','Brutto','Status','Link'].map(h=>(
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {faktury.map(f=>(
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-blue-700">{f.numer}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{f.data_wystawienia}</td>
                        <td className="px-4 py-3 text-xs text-gray-900 max-w-xs truncate">{f.klient_nazwa}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">{f.klient_nip}</td>
                        <td className="px-4 py-3 text-xs text-gray-700 text-right">{fmt(f.netto)}</td>
                        <td className="px-4 py-3 text-xs font-bold text-gray-900 text-right">{fmt(f.brutto)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.oplacona?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>
                            {f.oplacona?'✓ Opłacona':'⏳ Oczekuje'}</span></td>
                        <td className="px-4 py-3">
                          {f.link&&<a href={f.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">↗</a>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {fakturyTotal>50&&(
                <div className="flex justify-center gap-2 mt-3">
                  <button onClick={()=>loadFaktury(Math.max(0,fakturyOffset-50))} disabled={fakturyOffset===0} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40">‹</button>
                  <span className="text-xs text-gray-500 px-3 py-1.5">{Math.floor(fakturyOffset/50)+1}/{Math.ceil(fakturyTotal/50)}</span>
                  <button onClick={()=>loadFaktury(fakturyOffset+50)} disabled={fakturyOffset+50>=fakturyTotal} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40">›</button>
                </div>
              )}
            </>}
            {faktury.length===0&&!loading&&(
              <div className="text-center py-16 text-gray-400"><div className="text-4xl mb-3">🧾</div><p>Kliknij <strong>Pobierz</strong> aby załadować faktury z systemu księgowego</p></div>
            )}
          </div>
        )}

        {tab === 'klienci' && (
          <div>
            <div className="flex gap-2 mb-4 flex-wrap items-end">
              <div className="flex-1 min-w-48"><label className="text-xs text-gray-500 block mb-1">Szukaj klienta</label>
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Nazwa firmy..." className={inp}/></div>
              <button onClick={loadKlienci} disabled={loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading?'⏳':'🔍 Pobierz'}</button>
              {klienci.length>0&&(
                <button onClick={importKlientow} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  📥 Importuj do GazCRM</button>
              )}
            </div>
            {klienci.length>0&&(
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b text-xs text-gray-500">{klienciTotal} klientów łącznie</div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>{['Nazwa','NIP','Email','Telefon','Miasto'].map(h=>(
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {klienci.map(k=>(
                      <tr key={k.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{k.nazwa}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-600">{k.nip}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{k.email}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{k.telefon}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{k.miasto} {k.kod}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'koszty' && (
          <div>
            {cacheInfoK && (
              <div className="mb-3 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-800 flex-wrap">
                <span>{cacheInfoK}</span>
                <button onClick={syncKoszty} disabled={syncing||loading}
                  className="ml-auto bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium whitespace-nowrap">
                  {syncing ? '⏳ Syncuję...' : '🔄 Synchronizuj (tylko nowe)'}
                </button>
                <button onClick={clearKosztyCache} className="text-amber-600 hover:text-red-600 border border-amber-300 px-2 py-1.5 rounded-lg">🗑 Wyczyść cache</button>
              </div>
            )}
            <div className="flex gap-2 mb-4 flex-wrap items-end">
              <div><label className="text-xs text-gray-500 block mb-1">Data od</label>
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"/></div>
              <div><label className="text-xs text-gray-500 block mb-1">Data do</label>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"/></div>
              <button onClick={loadKoszty} disabled={loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading?'⏳':'🔍 Pobierz (100)'}</button>
              <button onClick={loadAllKoszty} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {loading?'⏳':'📥 Pobierz wszystkie i zapisz'}</button>
            </div>


            {koszty.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b text-xs text-gray-600 flex flex-wrap gap-4 items-center">
                  <span>Łącznie: <strong>{koszty.length}</strong> dokumentów kosztowych</span>
                  <span className="text-red-700">Suma brutto: <strong>{fmt(koszty.reduce((a:number,k:any)=>a+(k.kwota_brutto||0),0))}</strong></span>
                  <span className="text-gray-500">Netto: <strong>{fmt(koszty.reduce((a:number,k:any)=>a+(k.kwota_netto||0),0))}</strong></span>
                </div>
                <div className="overflow-x-auto">
                  <table style={{minWidth: 920}} className="text-sm w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap w-24">Data</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap w-32">Nr dokumentu</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 w-52">Dostawca / Nazwa</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap w-32">NIP</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 w-36">Kategoria</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap w-28">Netto</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap w-28">Brutto</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 w-24">Status</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 w-20">Budżet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {koszty.map((k:any)=>(
                        <tr key={k.id||k.uuid} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-xs font-mono text-gray-700 whitespace-nowrap">{k.data||'—'}</td>
                          <td className="px-3 py-2.5 text-xs font-mono text-blue-700 whitespace-nowrap">{k.numer||'—'}</td>
                          <td className="px-3 py-2.5">
                            <p className="text-xs font-medium text-gray-900" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={k.dostawca||k.nazwa}>{k.dostawca||k.nazwa||'—'}</p>
                            {k.opis && <p className="text-xs text-gray-400 mt-0.5" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={k.opis}>{k.opis}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono text-gray-500 whitespace-nowrap">{k.dostawca_nip||'—'}</td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full whitespace-nowrap inline-block">{k.kategoria||'—'}</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right text-gray-700 whitespace-nowrap tabular-nums">{fmt(k.kwota_netto||0)}</td>
                          <td className="px-3 py-2.5 text-xs font-bold text-right text-red-700 whitespace-nowrap tabular-nums">{fmt(k.kwota_brutto||0)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap inline-block ${k.status==='paid'||k.status==='oplacona'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>
                              {k.status||'—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button onClick={()=>importKosztDoBudzetu(k)}
                              className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap">
                              + Budżet
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td colSpan={5} className="px-3 py-2.5 text-xs font-semibold text-gray-600">RAZEM ({koszty.length} poz.)</td>
                        <td className="px-3 py-2.5 text-xs font-bold text-right text-gray-900 tabular-nums">{fmt(koszty.reduce((a:number,k:any)=>a+(k.kwota_netto||0),0))}</td>
                        <td className="px-3 py-2.5 text-xs font-bold text-right text-red-700 tabular-nums">{fmt(koszty.reduce((a:number,k:any)=>a+(k.kwota_brutto||0),0))}</td>
                        <td colSpan={2}/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
            {koszty.length===0&&!loading&&(
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">📉</div>
                <p>Kliknij <strong>Pobierz</strong> aby załadować koszty z systemu księgowego</p>
                <p className="text-xs mt-1 text-gray-300">Źródło: /api/v3/documents/costs.json</p>
              </div>
            )}
          </div>
        )}

        {tab === 'produkty' && (
          <div>
            <div className="flex gap-2 mb-4 items-end">
              <div className="flex-1 max-w-sm"><label className="text-xs text-gray-500 block mb-1">Szukaj</label>
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Nazwa produktu..." className={inp}/></div>
              <button onClick={loadProdukty} disabled={loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading?'⏳':'🔍 Pobierz'}</button>
            </div>
            {produkty.length>0&&(
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>{['Nazwa','Cena netto','VAT','J.m.'].map(h=>(
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {produkty.map(p=>(
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{p.nazwa}</td>
                        <td className="px-4 py-3">{fmt(p.cena_netto)}</td>
                        <td className="px-4 py-3"><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{p.vat}%</span></td>
                        <td className="px-4 py-3 text-xs text-gray-500">{p.jm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'budzet' && (
          <div>
            <div className="flex gap-2 mb-4 items-end flex-wrap">
              <div><label className="text-xs text-gray-500 block mb-1">Rok</label>
                <select value={budzetRok} onChange={e=>setBudzetRok(+e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                  {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 block mb-1">Miesiąc</label>
                <select value={budzetMiesiac} onChange={e=>setBudzetMiesiac(+e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                  {MIESIACE.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}</select></div>
              <button onClick={loadBudzet} disabled={loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading?'⏳':'📊 Pobierz przychody'}</button>
            </div>
            {budzetData&&(
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {l:'Przychód netto',v:fmt(budzetData.suma_netto),bg:'bg-blue-600'},
                    {l:'Przychód brutto',v:fmt(budzetData.suma_brutto),bg:'bg-green-600'},
                    {l:'Liczba faktur',v:String(budzetData.liczba),bg:'bg-gray-700'},
                  ].map(k=>(
                    <div key={k.l} className={`${k.bg} text-white rounded-xl p-4`}>
                      <p className="text-xs opacity-80 mb-1">{k.l}</p>
                      <p className="text-xl font-bold">{k.v}</p>
                    </div>
                  ))}
                </div>
                {budzetData.faktury?.length>0&&(
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b text-xs font-medium text-gray-600">Faktury w {MIESIACE[budzetMiesiac-1]} {budzetRok}</div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>{['Nr faktury','Data','Klient','Brutto'].map(h=>(
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {budzetData.faktury.map((f:any,i:number)=>(
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs text-blue-700">{f.numer}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{f.data}</td>
                            <td className="px-4 py-3 text-xs text-gray-900">{f.klient}</td>
                            <td className="px-4 py-3 text-xs font-bold text-right">{fmt(f.brutto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
