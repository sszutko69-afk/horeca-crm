'use client'

import { useState } from 'react'

type Stol = {
  id: number
  numer: number
  miejsca: number
  status: 'wolny' | 'zajety' | 'zarezerwowany' | 'nieaktywny'
  x: number
  y: number
  ksztalt: 'kwadrat' | 'okragly'
  kelner?: string
}

const STOŁY: Stol[] = [
  { id: 1,  numer: 1,  miejsca: 2, status: 'wolny',         x: 5,  y: 5,  ksztalt: 'okragly',  kelner: '' },
  { id: 2,  numer: 2,  miejsca: 2, status: 'zajety',        x: 20, y: 5,  ksztalt: 'okragly',  kelner: 'Marta K.' },
  { id: 3,  numer: 3,  miejsca: 4, status: 'zarezerwowany', x: 35, y: 5,  ksztalt: 'kwadrat',  kelner: '' },
  { id: 4,  numer: 4,  miejsca: 4, status: 'wolny',         x: 55, y: 5,  ksztalt: 'kwadrat',  kelner: '' },
  { id: 5,  numer: 5,  miejsca: 4, status: 'zajety',        x: 70, y: 5,  ksztalt: 'kwadrat',  kelner: 'Tomek W.' },
  { id: 6,  numer: 6,  miejsca: 6, status: 'wolny',         x: 5,  y: 35, ksztalt: 'kwadrat',  kelner: '' },
  { id: 7,  numer: 7,  miejsca: 6, status: 'zarezerwowany', x: 25, y: 35, ksztalt: 'kwadrat',  kelner: '' },
  { id: 8,  numer: 8,  miejsca: 2, status: 'zajety',        x: 50, y: 35, ksztalt: 'okragly',  kelner: 'Ania S.' },
  { id: 9,  numer: 9,  miejsca: 2, status: 'wolny',         x: 65, y: 35, ksztalt: 'okragly',  kelner: '' },
  { id: 10, numer: 10, miejsca: 8, status: 'zajety',        x: 5,  y: 65, ksztalt: 'kwadrat',  kelner: 'Tomek W.' },
  { id: 11, numer: 11, miejsca: 4, status: 'wolny',         x: 40, y: 65, ksztalt: 'kwadrat',  kelner: '' },
  { id: 12, numer: 12, miejsca: 6, status: 'zarezerwowany', x: 65, y: 65, ksztalt: 'kwadrat',  kelner: '' },
  { id: 13, numer: 13, miejsca: 2, status: 'nieaktywny',    x: 85, y: 35, ksztalt: 'okragly',  kelner: '' },
]

const STATUS_CFG = {
  wolny:        { color: '#16a34a', bg: '#f0fdf4', label: 'Wolny' },
  zajety:       { color: '#dc2626', bg: '#fef2f2', label: 'Zajęty' },
  zarezerwowany:{ color: '#d97706', bg: '#fffbeb', label: 'Zarezerwowany' },
  nieaktywny:   { color: '#9CA3AF', bg: '#F3F4F6', label: 'Nieaktywny' },
}

export default function StolyPage() {
  const [selected, setSelected] = useState<Stol | null>(null)

  const summary = {
    wolne:         STOŁY.filter(s => s.status === 'wolny').length,
    zajete:        STOŁY.filter(s => s.status === 'zajety').length,
    zarezerwowane: STOŁY.filter(s => s.status === 'zarezerwowany').length,
    miejsca:       STOŁY.filter(s => s.status !== 'nieaktywny').reduce((s, t) => s + t.miejsca, 0),
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Plan sali — Stoły</h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Interaktywny widok rozmieszczenia stolików i ich statusów</p>
      </div>

      {/* Legenda + statsy */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_CFG).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: k === 'wolny' || k === 'zarezerwowany' ? 5 : 2, background: v.color, display: 'inline-block' }} />
            <span style={{ color: '#374151' }}>{v.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 16px', fontSize: 12 }}>
          <span style={{ color: '#16a34a', fontWeight: 700 }}>Wolne: {summary.wolne}</span>
          <span style={{ color: '#dc2626', fontWeight: 700 }}>Zajęte: {summary.zajete}</span>
          <span style={{ color: '#d97706', fontWeight: 700 }}>Rezerwacje: {summary.zarezerwowane}</span>
          <span style={{ color: '#374151' }}>Miejsc łącznie: {summary.miejsca}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 280px' : '1fr', gap: 20 }}>
        {/* Plan sali */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🏠</span> Plan sali głównej
          </div>
          <div style={{ position: 'relative', height: 420, background: '#FAFAFA', backgroundImage: 'linear-gradient(#E5E7EB 1px, transparent 1px), linear-gradient(90deg, #E5E7EB 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            {/* Wejście */}
            <div style={{ position: 'absolute', bottom: 10, left: '45%', background: '#374151', color: '#fff', fontSize: 10, padding: '3px 10px', borderRadius: 4 }}>WEJŚCIE</div>
            {/* Bar */}
            <div style={{ position: 'absolute', top: 10, right: 10, background: '#7C3AED', color: '#fff', fontSize: 10, padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>BAR</div>

            {STOŁY.map(stol => {
              const cfg = STATUS_CFG[stol.status]
              const isRound = stol.ksztalt === 'okragly'
              const isSelected = selected?.id === stol.id
              return (
                <button
                  key={stol.id}
                  onClick={() => setSelected(isSelected ? null : stol)}
                  style={{
                    position: 'absolute',
                    left: `${stol.x}%`,
                    top: `${stol.y}%`,
                    width: stol.miejsca <= 2 ? 48 : stol.miejsca <= 4 ? 60 : 80,
                    height: stol.miejsca <= 2 ? 48 : stol.miejsca <= 4 ? 60 : 60,
                    borderRadius: isRound ? '50%' : 8,
                    background: cfg.bg,
                    border: `2px solid ${isSelected ? '#2563EB' : cfg.color}`,
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isSelected ? '0 0 0 3px #BFDBFE' : '0 1px 3px rgba(0,0,0,0.1)',
                    transition: 'all 120ms',
                    color: cfg.color,
                    fontSize: 11, fontWeight: 700,
                    zIndex: isSelected ? 10 : 1,
                  }}
                  title={`Stół ${stol.numer} — ${stol.miejsca} miejsca — ${cfg.label}`}
                >
                  <span style={{ fontSize: 13 }}>{stol.numer}</span>
                  <span style={{ fontSize: 9, opacity: 0.8 }}>{stol.miejsca}os</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Panel szczegółów */}
        {selected && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Stół {selected.numer}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9CA3AF' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div>
                <span style={{ color: '#6B7280' }}>Status:</span>
                <span style={{ marginLeft: 8, background: STATUS_CFG[selected.status].bg, color: STATUS_CFG[selected.status].color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                  {STATUS_CFG[selected.status].label}
                </span>
              </div>
              <div><span style={{ color: '#6B7280' }}>Miejsca:</span> <strong>{selected.miejsca}</strong></div>
              <div><span style={{ color: '#6B7280' }}>Kształt:</span> <strong>{selected.ksztalt === 'okragly' ? 'Okrągły' : 'Prostokątny'}</strong></div>
              {selected.kelner && <div><span style={{ color: '#6B7280' }}>Kelner:</span> <strong>{selected.kelner}</strong></div>}
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 7, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Nowa rezerwacja
              </button>
              <button style={{ background: '#fff', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 7, padding: '8px', fontSize: 12, cursor: 'pointer' }}>
                Oznacz jako {selected.status === 'wolny' ? 'zajęty' : 'wolny'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
