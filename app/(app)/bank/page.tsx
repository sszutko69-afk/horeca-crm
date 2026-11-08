'use client'

import { useState } from 'react'

const WYCIAG = [
  { id: 1, data: '2026-11-08', opis: 'eService S.A. - rozl. terminali 07.11',  kwota:  1842.00, typ: 'wpływ',  dopasowane: true  },
  { id: 2, data: '2026-11-08', opis: 'Przelew - Hurtownia Spożywcza "Mazur"',  kwota: -2340.00, typ: 'wydatek', dopasowane: true  },
  { id: 3, data: '2026-11-07', opis: 'eService S.A. - rozl. terminali 06.11',  kwota:  2156.50, typ: 'wpływ',  dopasowane: true  },
  { id: 4, data: '2026-11-07', opis: 'Wynagrodzenia - listopad (zaliczka)',     kwota: -8400.00, typ: 'wydatek', dopasowane: true  },
  { id: 5, data: '2026-11-06', opis: 'eService S.A. - rozl. terminali 05.11',  kwota:  1980.00, typ: 'wpływ',  dopasowane: true  },
  { id: 6, data: '2026-11-06', opis: 'PRZELEW WYCHODZĄCY 123456',               kwota:  -890.00, typ: 'wydatek', dopasowane: false },
  { id: 7, data: '2026-11-05', opis: 'Faktura VAT FV/2026/1104 - dostawa wina', kwota: -1250.00, typ: 'wydatek', dopasowane: true  },
  { id: 8, data: '2026-11-05', opis: 'eService S.A. - rozl. terminali 04.11',  kwota:  2340.00, typ: 'wpływ',  dopasowane: true  },
]

const SALDO = 24_830.45

export default function BankPage() {
  const [filter, setFilter] = useState<'wszystkie' | 'wpływ' | 'wydatek' | 'niedopasowane'>('wszystkie')

  const filtered = WYCIAG.filter(w => {
    if (filter === 'wpływ') return w.typ === 'wpływ'
    if (filter === 'wydatek') return w.typ === 'wydatek'
    if (filter === 'niedopasowane') return !w.dopasowane
    return true
  })

  const wplywy  = WYCIAG.filter(w => w.typ === 'wpływ').reduce((s, w) => s + w.kwota, 0)
  const wydatki = WYCIAG.filter(w => w.typ === 'wydatek').reduce((s, w) => s + Math.abs(w.kwota), 0)

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Integracja Bankowa</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Automatyczne pobieranie wyciągów — dopasowywanie płatności do faktur</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#16a34a' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
          Bank API Połączony
        </div>
      </div>

      {/* Saldo + KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, auto)', gap: 12, marginBottom: 24, alignItems: 'start' }}>
        <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563EB 100%)', borderRadius: 12, padding: '20px 24px', color: '#fff' }}>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>Saldo bieżące</p>
          <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700 }}>{SALDO.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</p>
          <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.6 }}>Rachunek główny — PKO Bank Polski</p>
        </div>
        {[
          { label: 'Wpływy (7 dni)', val: `+${wplywy.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł`, color: '#16a34a' },
          { label: 'Wydatki (7 dni)', val: `-${wydatki.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł`, color: '#dc2626' },
          { label: 'Niedopasowane', val: WYCIAG.filter(w => !w.dopasowane).length, color: '#d97706' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px', minWidth: 150 }}>
            <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{k.label}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: k.color, margin: '2px 0 0' }}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Wyciąg */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['wszystkie', 'wpływ', 'wydatek', 'niedopasowane'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: '1px solid',
                  borderColor: filter === f ? '#2563EB' : '#E5E7EB',
                  background: filter === f ? '#EFF6FF' : '#fff',
                  color: filter === f ? '#2563EB' : '#374151',
                  fontSize: 12, cursor: 'pointer', fontWeight: filter === f ? 600 : 400,
                }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'niedopasowane' && <span style={{ marginLeft: 4, background: '#fef2f2', color: '#dc2626', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>{WYCIAG.filter(w => !w.dopasowane).length}</span>}
              </button>
            ))}
          </div>
          <button style={{ background: '#F3F4F6', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', color: '#374151' }}>
            Pobierz wyciąg
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Data', 'Opis', 'Kwota', 'Dopasowanie'].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((w, i) => (
              <tr key={w.id} style={{ background: !w.dopasowane ? '#fffbeb' : i % 2 === 0 ? '#fff' : '#FAFAFA', borderTop: '1px solid #F3F4F6' }}>
                <td style={{ padding: '10px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>{w.data}</td>
                <td style={{ padding: '10px 14px', color: '#374151' }}>{w.opis}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: w.typ === 'wpływ' ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap' }}>
                  {w.typ === 'wpływ' ? '+' : ''}{w.kwota.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {w.dopasowane ? (
                    <span style={{ color: '#16a34a', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>✓</span> Dopasowane
                    </span>
                  ) : (
                    <button style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      Dopasuj ręcznie
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
