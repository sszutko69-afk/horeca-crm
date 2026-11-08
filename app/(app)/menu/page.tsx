'use client'

import { useState } from 'react'

type Danie = {
  id: number
  nazwa: string
  kategoria: string
  cena: number
  dostepne: boolean
  alergeny: string[]
  kcal: number
  opis: string
}

const MENU: Danie[] = [
  { id: 1,  nazwa: 'Żurek staropolski',          kategoria: 'Zupy',      cena: 22, dostepne: true,  alergeny: ['gluten', 'jajka', 'mleko'], kcal: 310, opis: 'Podawany w chlebie, z jajkiem i białą kiełbasą' },
  { id: 2,  nazwa: 'Zupa pomidorowa z ryżem',    kategoria: 'Zupy',      cena: 18, dostepne: true,  alergeny: ['gluten'],                   kcal: 220, opis: '' },
  { id: 3,  nazwa: 'Sałatka grecka',             kategoria: 'Sałatki',   cena: 28, dostepne: true,  alergeny: ['mleko'],                    kcal: 280, opis: 'Feta, oliwki, ogórek, pomidor' },
  { id: 4,  nazwa: 'Carpaccio z wołowiny',       kategoria: 'Przystawki', cena: 42, dostepne: true, alergeny: ['jajka', 'mleko'],           kcal: 180, opis: 'Z parmezanem i rukolą' },
  { id: 5,  nazwa: 'Pierogi ruskie',             kategoria: 'Dania główne', cena: 32, dostepne: true, alergeny: ['gluten', 'mleko'],        kcal: 480, opis: '8 sztuk, z cebulą i śmietaną' },
  { id: 6,  nazwa: 'Kotlet schabowy z buraczkami', kategoria: 'Dania główne', cena: 48, dostepne: true, alergeny: ['gluten', 'jajka'],     kcal: 650, opis: 'Z ziemniakami i surówką' },
  { id: 7,  nazwa: 'Łosoś grillowany',           kategoria: 'Dania główne', cena: 68, dostepne: true, alergeny: ['ryby'],                  kcal: 420, opis: 'Z warzywami i sosem cytrynowym' },
  { id: 8,  nazwa: 'Risotto z grzybami',         kategoria: 'Dania główne', cena: 52, dostepne: false, alergeny: ['mleko'],                kcal: 540, opis: 'Z truflową śmietaną i parmezanem' },
  { id: 9,  nazwa: 'Tiramisu',                   kategoria: 'Desery',    cena: 24, dostepne: true,  alergeny: ['gluten', 'jajka', 'mleko'], kcal: 390, opis: 'Klasyczny włoski deser' },
  { id: 10, nazwa: 'Sernik nowojorski',           kategoria: 'Desery',    cena: 22, dostepne: true,  alergeny: ['gluten', 'jajka', 'mleko'], kcal: 420, opis: 'Z sosem truskawkowym' },
  { id: 11, nazwa: 'Kawa espresso',              kategoria: 'Napoje',    cena: 10, dostepne: true,  alergeny: [],                           kcal: 5,   opis: '' },
  { id: 12, nazwa: 'Lemonade własna',            kategoria: 'Napoje',    cena: 14, dostepne: true,  alergeny: [],                           kcal: 90,  opis: 'Mięta, cytryna, miód' },
]

const KATEGORIE = ['Wszystkie', ...Array.from(new Set(MENU.map(d => d.kategoria)))]

const ALERGEN_COLOR: Record<string, string> = {
  gluten: '#F59E0B',
  jajka: '#10B981',
  mleko: '#3B82F6',
  ryby: '#8B5CF6',
  orzechy: '#EF4444',
}

export default function MenuPage() {
  const [kat, setKat] = useState('Wszystkie')
  const [showUnavail, setShowUnavail] = useState(true)

  const filtered = MENU.filter(d =>
    (kat === 'Wszystkie' || d.kategoria === kat) &&
    (showUnavail || d.dostepne)
  )

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Menu & Dania</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Zarządzanie kartą menu, cenami i dostępnością</p>
        </div>
        <button style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Dodaj danie
        </button>
      </div>

      {/* Filtry */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {KATEGORIE.map(k => (
          <button key={k} onClick={() => setKat(k)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid',
              borderColor: kat === k ? '#2563EB' : '#E5E7EB',
              background: kat === k ? '#EFF6FF' : '#fff',
              color: kat === k ? '#2563EB' : '#374151',
              fontSize: 12, cursor: 'pointer', fontWeight: kat === k ? 600 : 400,
            }}>
            {k}
          </button>
        ))}
        <label style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
          <input type="checkbox" checked={showUnavail} onChange={e => setShowUnavail(e.target.checked)} />
          Pokaż niedostępne
        </label>
      </div>

      {/* Grid dań */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {filtered.map(danie => (
          <div key={danie.id} style={{
            background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16,
            opacity: danie.dostepne ? 1 : 0.55, position: 'relative',
          }}>
            {!danie.dostepne && (
              <span style={{ position: 'absolute', top: 10, right: 10, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                NIEDOSTĘPNE
              </span>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#111827' }}>{danie.nazwa}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9CA3AF' }}>{danie.kategoria}</p>
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#2563EB', whiteSpace: 'nowrap' }}>{danie.cena} zł</span>
            </div>
            {danie.opis && <p style={{ margin: '4px 0 8px', fontSize: 12, color: '#6B7280' }}>{danie.opis}</p>}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              {danie.alergeny.map(a => (
                <span key={a} style={{ background: `${ALERGEN_COLOR[a] || '#E5E7EB'}22`, color: ALERGEN_COLOR[a] || '#374151', border: `1px solid ${ALERGEN_COLOR[a] || '#E5E7EB'}44`, fontSize: 10, padding: '2px 7px', borderRadius: 20 }}>
                  {a}
                </span>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }}>{danie.kcal} kcal</span>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <button style={{ flex: 1, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px', fontSize: 11, cursor: 'pointer', color: '#374151' }}>Edytuj</button>
              <button style={{ flex: 1, background: danie.dostepne ? '#fef2f2' : '#f0fdf4', border: `1px solid ${danie.dostepne ? '#fca5a5' : '#86efac'}`, borderRadius: 6, padding: '5px', fontSize: 11, cursor: 'pointer', color: danie.dostepne ? '#dc2626' : '#16a34a' }}>
                {danie.dostepne ? 'Wyłącz' : 'Włącz'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
