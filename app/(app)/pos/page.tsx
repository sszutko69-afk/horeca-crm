'use client'

import { useState } from 'react'

const TRANSAKCJE = [
  { id: 'T-0892', czas: '14:32', stol: 5, kwota: 186.50, metoda: 'karta', status: 'rozliczone', kelner: 'Marta K.' },
  { id: 'T-0891', czas: '14:18', stol: 2, kwota: 54.00,  metoda: 'gotówka', status: 'rozliczone', kelner: 'Tomek W.' },
  { id: 'T-0890', czas: '13:55', stol: 7, kwota: 312.00, metoda: 'karta', status: 'rozliczone', kelner: 'Ania S.' },
  { id: 'T-0889', czas: '13:40', stol: 10,kwota: 76.00,  metoda: 'terminal', status: 'rozliczone', kelner: 'Marta K.' },
  { id: 'T-0888', czas: '12:55', stol: 3, kwota: 44.50,  metoda: 'gotówka', status: 'rozliczone', kelner: 'Tomek W.' },
  { id: 'T-0887', czas: '12:30', stol: 8, kwota: 228.00, metoda: 'karta', status: 'rozliczone', kelner: 'Ania S.' },
]

const PRODUKTY = [
  { nazwa: 'Kotlet schabowy', ilosc: 24, kwota: 1152 },
  { nazwa: 'Łosoś grillowany', ilosc: 18, kwota: 1224 },
  { nazwa: 'Pierogi ruskie',    ilosc: 31, kwota: 992  },
  { nazwa: 'Tiramisu',          ilosc: 42, kwota: 1008 },
  { nazwa: 'Kawa espresso',     ilosc: 87, kwota: 870  },
]

export default function PosPage() {
  const [connected] = useState(true)

  const obroty = TRANSAKCJE.reduce((s, t) => s + t.kwota, 0)

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Integracja POS</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Synchronizacja z systemem punktu sprzedaży — transakcje, paragon i stany magazynowe</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: connected ? '#f0fdf4' : '#fef2f2', border: `1px solid ${connected ? '#86efac' : '#fca5a5'}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: connected ? '#16a34a' : '#dc2626' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#16a34a' : '#dc2626', display: 'inline-block', animation: connected ? 'pulse 2s infinite' : 'none' }} />
          {connected ? 'POS Połączony' : 'Rozłączony'}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Obrót dziś', val: `${obroty.toFixed(0)} zł`, color: '#2563EB' },
          { label: 'Transakcji', val: TRANSAKCJE.length, color: '#7C3AED' },
          { label: 'Karta', val: `${TRANSAKCJE.filter(t => t.metoda === 'karta').length}`, color: '#16a34a' },
          { label: 'Gotówka', val: `${TRANSAKCJE.filter(t => t.metoda === 'gotówka').length}`, color: '#d97706' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: '2px 0 0' }}>{k.val}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Ostatnie transakcje */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 13, fontWeight: 600, color: '#111827' }}>
            Ostatnie transakcje
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['ID', 'Czas', 'Stół', 'Kwota', 'Metoda', 'Kelner'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRANSAKCJE.map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderTop: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#6B7280' }}>{t.id}</td>
                  <td style={{ padding: '9px 14px', color: '#374151', fontWeight: 600 }}>{t.czas}</td>
                  <td style={{ padding: '9px 14px', color: '#374151' }}>Stół {t.stol}</td>
                  <td style={{ padding: '9px 14px', color: '#111827', fontWeight: 700 }}>{t.kwota.toFixed(2)} zł</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ background: t.metoda === 'karta' ? '#EFF6FF' : t.metoda === 'terminal' ? '#F5F3FF' : '#FFFBEB', color: t.metoda === 'karta' ? '#2563EB' : t.metoda === 'terminal' ? '#7C3AED' : '#d97706', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                      {t.metoda}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', color: '#374151' }}>{t.kelner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top produkty */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', alignSelf: 'flex-start' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 13, fontWeight: 600, color: '#111827' }}>
            Bestsellery dziś
          </div>
          {PRODUKTY.map((p, i) => {
            const max = Math.max(...PRODUKTY.map(x => x.kwota))
            return (
              <div key={p.nazwa} style={{ padding: '10px 16px', borderTop: i > 0 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: '#374151', fontWeight: 500 }}>{p.nazwa}</span>
                  <span style={{ color: '#111827', fontWeight: 700 }}>{p.kwota} zł</span>
                </div>
                <div style={{ background: '#F3F4F6', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(p.kwota / max) * 100}%`, height: '100%', background: '#2563EB', borderRadius: 4 }} />
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: '#9CA3AF' }}>{p.ilosc} szt.</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Ustawienia połączenia */}
      <div style={{ marginTop: 20, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Konfiguracja POS</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13 }}>
          <div><span style={{ color: '#6B7280' }}>System:</span> <strong>POSbistro v4.2</strong></div>
          <div><span style={{ color: '#6B7280' }}>Endpoint:</span> <strong>pos.demo.local:8080</strong></div>
          <div><span style={{ color: '#6B7280' }}>Ostatnia sync:</span> <strong>przed chwilą</strong></div>
          <div><span style={{ color: '#6B7280' }}>Tryb:</span> <strong>Automatyczny (60s)</strong></div>
        </div>
      </div>
    </div>
  )
}
