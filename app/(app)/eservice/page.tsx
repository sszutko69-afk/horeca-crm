'use client'

const TRANSAKCJE = [
  { id: 'ES-44231', data: '2026-11-08', godzina: '14:32', kwota: 186.50, typ: 'sprzedaż', terminal: 'T1', status: 'zatwierdzona' },
  { id: 'ES-44230', data: '2026-11-08', godzina: '14:18', kwota: 54.00,  typ: 'sprzedaż', terminal: 'T2', status: 'zatwierdzona' },
  { id: 'ES-44229', data: '2026-11-08', godzina: '13:55', kwota: 312.00, typ: 'sprzedaż', terminal: 'T1', status: 'zatwierdzona' },
  { id: 'ES-44228', data: '2026-11-08', godzina: '13:40', kwota: 76.00,  typ: 'sprzedaż', terminal: 'T3', status: 'zatwierdzona' },
  { id: 'ES-44227', data: '2026-11-08', godzina: '12:55', kwota: 44.50,  typ: 'sprzedaż', terminal: 'T2', status: 'zatwierdzona' },
  { id: 'ES-44226', data: '2026-11-08', godzina: '12:30', kwota: 228.00, typ: 'sprzedaż', terminal: 'T1', status: 'zatwierdzona' },
  { id: 'ES-44225', data: '2026-11-07', godzina: '20:14', kwota: 156.00, typ: 'sprzedaż', terminal: 'T1', status: 'zatwierdzona' },
  { id: 'ES-44224', data: '2026-11-07', godzina: '19:50', kwota: 44.00,  typ: 'zwrot',    terminal: 'T2', status: 'zatwierdzona' },
]

const TERMINALE = [
  { id: 'T1', model: 'eService Smart 2', sala: 'Sala główna',  status: 'online',  batchNr: 44 },
  { id: 'T2', model: 'eService Smart 2', sala: 'Bar',          status: 'online',  batchNr: 44 },
  { id: 'T3', model: 'eService Compact', sala: 'Taras',        status: 'offline', batchNr: 43 },
]

export default function EServicePage() {
  const dzis = TRANSAKCJE.filter(t => t.data === '2026-11-08')
  const obrot = dzis.filter(t => t.typ === 'sprzedaż').reduce((s, t) => s + t.kwota, 0)
  const zwroty = dzis.filter(t => t.typ === 'zwrot').reduce((s, t) => s + t.kwota, 0)

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Integracja eService</h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Obsługa terminali płatniczych — transakcje kartą, raporty, rozliczenia</p>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Obrót kartą dziś', val: `${obrot.toFixed(2)} zł`, color: '#2563EB' },
          { label: 'Transakcji', val: dzis.length, color: '#7C3AED' },
          { label: 'Zwroty', val: `${zwroty.toFixed(2)} zł`, color: '#dc2626' },
          { label: 'Terminale online', val: `${TERMINALE.filter(t => t.status === 'online').length}/${TERMINALE.length}`, color: '#16a34a' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: '2px 0 0' }}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Terminale */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Terminale płatnicze</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {TERMINALE.map(t => (
            <div key={t.id} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{t.id}</span>
                <span style={{ background: t.status === 'online' ? '#f0fdf4' : '#fef2f2', color: t.status === 'online' ? '#16a34a' : '#dc2626', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
                  {t.status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span>Model: <strong style={{ color: '#374151' }}>{t.model}</strong></span>
                <span>Lokalizacja: <strong style={{ color: '#374151' }}>{t.sala}</strong></span>
                <span>Batch: <strong style={{ color: '#374151' }}>#{t.batchNr}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historia transakcji */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 13, fontWeight: 600, color: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Historia transakcji</span>
          <button style={{ background: '#F3F4F6', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', color: '#374151' }}>
            Eksport CSV
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['ID', 'Data', 'Godzina', 'Terminal', 'Typ', 'Kwota', 'Status'].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRANSAKCJE.map((t, i) => (
              <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderTop: '1px solid #F3F4F6' }}>
                <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{t.id}</td>
                <td style={{ padding: '8px 14px', color: '#374151' }}>{t.data}</td>
                <td style={{ padding: '8px 14px', color: '#374151', fontWeight: 600 }}>{t.godzina}</td>
                <td style={{ padding: '8px 14px', color: '#374151' }}>{t.terminal}</td>
                <td style={{ padding: '8px 14px' }}>
                  <span style={{ background: t.typ === 'sprzedaż' ? '#EFF6FF' : '#fef2f2', color: t.typ === 'sprzedaż' ? '#2563EB' : '#dc2626', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>
                    {t.typ}
                  </span>
                </td>
                <td style={{ padding: '8px 14px', fontWeight: 700, color: t.typ === 'zwrot' ? '#dc2626' : '#111827' }}>
                  {t.typ === 'zwrot' ? '-' : ''}{t.kwota.toFixed(2)} zł
                </td>
                <td style={{ padding: '8px 14px' }}>
                  <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 600 }}>{t.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
