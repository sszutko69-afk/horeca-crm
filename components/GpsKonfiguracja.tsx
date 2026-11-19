'use client'

import { useEffect, useState } from 'react'

// Konfiguracja trackera GPS firmy (Flespi): kanał, token API, IMEI i nazwa pojazdu. Token jest zapisywany po stronie serwera
// i nigdy nie wraca do przeglądarki. Zmiany może zapisać tylko administrator firmy.
export default function GpsKonfiguracja() {
  const [otwarte, setOtwarte] = useState(false)
  const [stan, setStan] = useState<{ skonfigurowany: boolean } | null>(null)
  const [kanal, setKanal] = useState('')
  const [imei, setImei] = useState('')
  const [nazwa, setNazwa] = useState('Pojazd')
  const [token, setToken] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/gps/konfiguracja').then(r => r.json()).then(j => {
      if (j.error) return
      setStan({ skonfigurowany: !!j.skonfigurowany }); setKanal(j.kanal ?? ''); setImei(j.imei ?? ''); setNazwa(j.pojazd_nazwa ?? 'Pojazd')
    }).catch(() => {})
  }, [])

  async function zapisz(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('')
    const r = await fetch('/api/gps/konfiguracja', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kanal, imei, pojazd_nazwa: nazwa, token }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(j.error ?? 'Nie udało się zapisać.'); return }
    setToken(''); setStan({ skonfigurowany: true }); setMsg('Zapisano. Kliknij „Sync flespi", aby pobrać pozycje.')
  }

  const inp = 'px-3 py-2 border border-gray-200 rounded-lg text-sm w-full bg-white'
  return (
    <div className="px-4 md:px-6 pt-3">
      <button type="button" onClick={() => setOtwarte(o => !o)} className="text-xs text-gray-600 border border-gray-200 bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50">
        ⚙ Tracker GPS {stan?.skonfigurowany ? '(skonfigurowany)' : '(nieskonfigurowany)'}
      </button>
      {otwarte && (
        <form onSubmit={zapisz} className="mt-2 bg-white border border-gray-200 rounded-xl p-4 grid md:grid-cols-2 gap-3 max-w-3xl">
          <p className="md:col-span-2 text-xs text-gray-500">
            Pozycje pobieramy z serwisu Flespi (tracker FMC lub inny wspierany). Podaj numer kanału i token API ze swojego konta Flespi.
            Token jest przechowywany po stronie serwera i nie jest widoczny dla pozostałych użytkowników. Konfiguracja: administrator.
          </p>
          <div><label className="text-xs text-gray-500">Kanał Flespi</label><input className={inp} value={kanal} onChange={e => setKanal(e.target.value)} placeholder="np. 1234567" /></div>
          <div><label className="text-xs text-gray-500">Token API Flespi</label><input className={inp} type="password" value={token} onChange={e => setToken(e.target.value)} placeholder={stan?.skonfigurowany ? 'zostaw puste, aby nie zmieniać' : 'wklej token'} autoComplete="off" /></div>
          <div><label className="text-xs text-gray-500">IMEI trackera</label><input className={inp} value={imei} onChange={e => setImei(e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Nazwa pojazdu</label><input className={inp} value={nazwa} onChange={e => setNazwa(e.target.value)} /></div>
          <div className="md:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={busy} style={{ background: '#111827', color: '#FFFFFF' }} className="px-4 py-2 rounded-lg text-sm disabled:opacity-50">{busy ? 'Zapisywanie…' : 'Zapisz konfigurację'}</button>
            {msg && <span className="text-xs text-gray-600">{msg}</span>}
          </div>
        </form>
      )}
    </div>
  )
}
