'use client'

import { liczDostep, dniTekst, type FirmaPlan } from '@/lib/plany'

const KONTAKT = 'skrojocrm@gmail.com'

// Styl inline: globalna reguła `a { color }` w globals.css nadpisuje klasy Tailwind (biały tekst był niewidoczny)
const PRZYCISK: React.CSSProperties = { background: '#2FB36D', color: '#FFFFFF', textDecoration: 'none' }

// Pasek informacji o planie nad treścią aplikacji.
export default function PlanBanner({ firma }: { firma: FirmaPlan | null }) {
  if (!firma) return null
  const d = liczDostep(firma)
  if (d.powod === 'demo' || d.powod === 'subskrypcja') return null

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
