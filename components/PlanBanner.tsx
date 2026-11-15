'use client'

import { useState } from 'react'
import { liczDostep, dniTekst, type FirmaPlan } from '@/lib/plany'
import { BRANZE_ONB } from '@/lib/branze'

// Konto demo: wybór branży przełącza całe demo (moduły, terminologia, dane przykładowe).
function DemoBranza({ obecna }: { obecna: string }) {
  const [busy, setBusy] = useState(false)
  const [blad, setBlad] = useState('')
  async function zmien(branza: string) {
    if (branza === obecna) return
    setBusy(true); setBlad('')
    const r = await fetch('/api/demo/branza', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branza }) })
    if (!r.ok) { setBlad((await r.json().catch(() => ({}))).error ?? 'Nie udało się przełączyć.'); setBusy(false); return }
    window.location.href = '/dashboard'
  }
  return (
    <div style={{ background: '#E8F5EE', borderBottom: '1px solid #BFE3CF', color: '#14532d' }} className="px-4 py-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
      <b>Konto demonstracyjne.</b>
      <label className="flex items-center gap-2">Pokaż demo dla branży:
        <select value={obecna} disabled={busy} onChange={e => zmien(e.target.value)} className="border border-green-300 rounded-md px-2 py-1 bg-white text-gray-900 text-sm">
          {BRANZE_ONB.map(b => <option key={b.slug} value={b.slug}>{b.nazwa}</option>)}
        </select>
      </label>
      {busy && <span>Przełączanie…</span>}
      {blad && <span style={{ color: '#b91c1c' }}>{blad}</span>}
    </div>
  )
}

const KONTAKT = 'skrojocrm@gmail.com'

// Styl inline: globalna reguła `a { color }` w globals.css nadpisuje klasy Tailwind (biały tekst był niewidoczny)
const PRZYCISK: React.CSSProperties = { background: '#2FB36D', color: '#FFFFFF', textDecoration: 'none' }

// Pasek informacji o planie nad treścią aplikacji.
export default function PlanBanner({ firma }: { firma: FirmaPlan | null }) {
  if (!firma) return null
  const d = liczDostep(firma)
  if (d.powod === 'demo') return <DemoBranza obecna={firma.branza ?? 'horeca'} />
  if (d.powod === 'subskrypcja') return null

  const kontakt = (
    <a href={`mailto:${KONTAKT}?subject=Dopasowanie%20systemu%20Skrojo`} className="underline font-medium">skontaktuj się z zespołem SKROJO</a>
  )

  if (d.powod === 'trial') {
    return (
      <div style={{ background: '#E8F5EE', borderBottom: '1px solid #BFE3CF', color: '#14532d' }} className="px-4 py-2.5 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          <b>Korzystasz z pełnej wersji systemu.</b> Za {dniTekst(d.dniDoKonca ?? 1)} system przejdzie do wersji podstawowej.
          Wykup subskrypcję lub {kontakt} w celu dopasowania systemu do Twoich potrzeb.
        </span>
        <a href="/subskrypcja" style={PRZYCISK} className="ml-auto px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap">Wykup subskrypcję</a>
      </div>
    )
  }

  return (
    <div style={{ background: '#FFF4E0', borderBottom: '1px solid #F5D9A6', color: '#7a4a00' }} className="px-4 py-2.5 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>
        <b>{d.powod === 'zaleglosc' ? 'Płatność nie powiodła się.' : 'Korzystasz z wersji podstawowej.'}</b>{' '}
        Moduły rozszerzone są wyłączone. Wykup subskrypcję lub {kontakt} w celu dopasowania systemu do Twoich potrzeb.
      </span>
      <a href="/subskrypcja" style={PRZYCISK} className="ml-auto px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap">Wykup subskrypcję</a>
    </div>
  )
}
