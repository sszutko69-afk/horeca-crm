'use client'

import { useState } from 'react'

type Rezerwacja = {
  id: number
  godzina: string
  imie: string
  liczbaOsob: number
  stol: number
  status: 'potwierdzona' | 'oczekuje' | 'anulowana'
  telefon: string
  uwagi: string
}

const DEMO_DATA: Rezerwacja[] = [
  { id: 1, godzina: '12:00', imie: 'Jan Kowalski',      liczbaOsob: 4, stol: 5,  status: 'potwierdzona', telefon: '600 100 200', uwagi: 'urodziny' },
  { id: 2, godzina: '13:30', imie: 'Anna Nowak',        liczbaOsob: 2, stol: 2,  status: 'potwierdzona', telefon: '601 200 300', uwagi: '' },
  { id: 3, godzina: '14:00', imie: 'Firma ABC Sp. z o.o.', liczbaOsob: 8, stol: 10, status: 'oczekuje',     telefon: '602 300 400', uwagi: 'lunch biznesowy' },
  { id: 4, godzina: '15:30', imie: 'Maria Wiśniewska',  liczbaOsob: 3, stol: 7,  status: 'potwierdzona', telefon: '603 400 500', uwagi: '' },
  { id: 5, godzina: '18:00', imie: 'Piotr Zając',       liczbaOsob: 6, stol: 12, status: 'oczekuje',     telefon: '604 500 600', uwagi: 'rocznica' },
  { id: 6, godzina: '19:30', imie: 'Hotel Złoty Lew',   liczbaOsob: 20, stol: 0,  status: 'potwierdzona', telefon: '605 600 700', uwagi: 'impreza — cała sala prywatna' },
  { id: 7, godzina: '20:00', imie: 'Katarzyna Dąbrowska', liczbaOsob: 2, stol: 3, status: 'anulowana',    telefon: '606 700 800', uwagi: '' },
]

const STATUS_COLOR: Record<string, string> = {
  potwierdzona: '#16a34a',
  oczekuje:     '#d97706',
  anulowana:    '#dc2626',
}
const STATUS_BG: Record<string, string> = {
  potwierdzona: '#f0fdf4',
  oczekuje:     '#fffbeb',
  anulowana:    '#fef2f2',
}

const DAYS = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nie']
const TODAY = 8

export default function RezerwacjePage() {
  const [selectedDay, setSelectedDay] = useState(TODAY)
  const [filter, setFilter] = useState<'wszystkie' | 'potwierdzona' | 'oczekuje'>('wszystkie')

  const filtered = DEMO_DATA.filter(r =>
    filter === 'wszystkie' ? true : r.status === filter
  )

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Nagłówek */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Rezerwacje stolików</h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Zarządzanie rezerwacjami — dziś, {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Statystyki */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Wszystkich', val: DEMO_DATA.length, color: '#2563EB' },
          { label: 'Potwierdzonych', val: DEMO_DATA.filter(r => r.status === 'potwierdzona').length, color: '#16a34a' },
          { label: 'Oczekuje', val: DEMO_DATA.filter(r => r.status === 'oczekuje').length, color: '#d97706' },
          { label: 'Gości łącznie', val: DEMO_DATA.filter(r => r.status !== 'anulowana').reduce((s, r) => s + r.liczbaOsob, 0), color: '#7C3AED' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: s.color, margin: '2px 0 0' }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Kalendaryk tygodnia */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 8 }}>
        {DAYS.map((d, i) => {
          const day = i + 6
          const isToday = day === TODAY
          const isSelected = day === selectedDay
          return (
            <button key={d} onClick={() => setSelectedDay(day)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: isSelected ? '#2563EB' : isToday ? '#EFF6FF' : 'transparent',
                color: isSelected ? '#fff' : isToday ? '#2563EB' : '#374151',
                fontSize: 12, fontWeight: isSelected || isToday ? 700 : 400,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{d}</span>
              <span>{day}</span>
              {isToday && !isSelected && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#2563EB', display: 'block' }} />}
            </button>
          )
        })}
      </div>

      {/* Filtry + tabela */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['wszystkie', 'potwierdzona', 'oczekuje'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: '1px solid',
                  borderColor: filter === f ? '#2563EB' : '#E5E7EB',
                  background: filter === f ? '#EFF6FF' : '#fff',
                  color: filter === f ? '#2563EB' : '#374151',
                  fontSize: 12, cursor: 'pointer', fontWeight: filter === f ? 600 : 400,
                }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button style={{
            background: '#2563EB', color: '#fff', border: 'none', borderRadius: 7,
            padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            + Nowa rezerwacja
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Godzina', 'Gość / Firma', 'Osób', 'Stół', 'Telefon', 'Uwagi', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#111827' }}>{r.godzina}</td>
                <td style={{ padding: '10px 14px', color: '#111827' }}>{r.imie}</td>
                <td style={{ padding: '10px 14px', color: '#374151', textAlign: 'center' }}>{r.liczbaOsob}</td>
                <td style={{ padding: '10px 14px', color: '#374151' }}>{r.stol > 0 ? `Stół ${r.stol}` : '— cała sala'}</td>
                <td style={{ padding: '10px 14px', color: '#6B7280' }}>{r.telefon}</td>
                <td style={{ padding: '10px 14px', color: '#6B7280', fontStyle: r.uwagi ? 'normal' : 'italic' }}>{r.uwagi || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    background: STATUS_BG[r.status], color: STATUS_COLOR[r.status],
                    border: `1px solid ${STATUS_COLOR[r.status]}33`,
                    borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                  }}>
                    {r.status}
                  </span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <button style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#374151' }}>
                    Edytuj
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Brak rezerwacji dla wybranego filtra.</div>
        )}
      </div>
    </div>
  )
}
