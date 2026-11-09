'use client'

import { useState } from 'react'

const TRANSAKCJE = [
  { id: 'ES-44231', data: '2026-11-08', godzina: '14:32', kwota: 186.50, typ: 'sprzedaż', terminal: 'T1', status: 'zatwierdzona' },
  { id: 'ES-44230', data: '2026-11-08', godzina: '14:18', kwota:  54.00, typ: 'sprzedaż', terminal: 'T2', status: 'zatwierdzona' },
  { id: 'ES-44229', data: '2026-11-08', godzina: '13:55', kwota: 312.00, typ: 'sprzedaż', terminal: 'T1', status: 'zatwierdzona' },
  { id: 'ES-44228', data: '2026-11-08', godzina: '13:40', kwota:  76.00, typ: 'sprzedaż', terminal: 'T3', status: 'zatwierdzona' },
  { id: 'ES-44227', data: '2026-11-08', godzina: '12:55', kwota:  44.50, typ: 'sprzedaż', terminal: 'T2', status: 'zatwierdzona' },
  { id: 'ES-44226', data: '2026-11-08', godzina: '12:30', kwota: 228.00, typ: 'sprzedaż', terminal: 'T1', status: 'zatwierdzona' },
  { id: 'ES-44225', data: '2026-11-07', godzina: '20:14', kwota: 156.00, typ: 'sprzedaż', terminal: 'T1', status: 'zatwierdzona' },
  { id: 'ES-44224', data: '2026-11-07', godzina: '19:50', kwota:  44.00, typ: 'zwrot',    terminal: 'T2', status: 'zatwierdzona' },
]

const TERMINALE = [
  { id: 'T1', model: 'eService Smart 2', sala: 'Sala główna', status: 'online',  batchNr: 44 },
  { id: 'T2', model: 'eService Smart 2', sala: 'Bar',         status: 'online',  batchNr: 44 },
  { id: 'T3', model: 'eService Compact', sala: 'Taras',       status: 'offline', batchNr: 43 },
]

export default function EServicePage() {
  const [tab, setTab] = useState<'dashboard' | 'connect'>('dashboard')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [creds, setCreds] = useState({ merchantId: '', terminalId: '', apiKey: '', env: 'production' })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<null | 'ok' | 'err'>(null)

  const dzis = TRANSAKCJE.filter(t => t.data === '2026-11-08')
  const obrot = dzis.filter(t => t.typ === 'sprzedaż').reduce((s, t) => s + t.kwota, 0)
  const zwroty = dzis.filter(t => t.typ === 'zwrot').reduce((s, t) => s + t.kwota, 0)

  async function testConnection() {
    setTesting(true); setTestResult(null)
    await new Promise(r => setTimeout(r, 2000))
    setTestResult('ok'); setTesting(false)
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Integracja eService</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Obsługa terminali płatniczych — transakcje kartą, raporty, rozliczenia</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('connect')}
            style={{ padding: '7px 14px', background: tab === 'connect' ? '#1e3a5f' : '#F3F4F6', color: tab === 'connect' ? '#fff' : '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            🔌 Skonfiguruj API
          </button>
        </div>
      </div>

      {tab === 'connect' && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #F3F4F6' }}>
            {[{ n: 1, l: 'Dane merchant' }, { n: 2, l: 'Klucze API' }, { n: 3, l: 'Test terminali' }].map(s => (
              <div key={s.n} style={{ flex: 1, padding: '8px 0', textAlign: 'center', borderBottom: step === s.n ? '2px solid #2563EB' : '2px solid transparent', marginBottom: -2 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: step >= s.n ? '#2563EB' : '#E5E7EB', color: step >= s.n ? '#fff' : '#9CA3AF', fontSize: 12, fontWeight: 700, marginRight: 6 }}>{s.n}</span>
                <span style={{ fontSize: 13, fontWeight: step === s.n ? 600 : 400, color: step === s.n ? '#111827' : '#9CA3AF' }}>{s.l}</span>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div style={{ maxWidth: 480 }}>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Wprowadź dane Twojego konta eService:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Merchant ID', key: 'merchantId', placeholder: 'ESV-XXXXXX' },
                  { label: 'Terminal ID (pierwszy terminal)', key: 'terminalId', placeholder: 'T-XXXXXXXX' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{f.label}</label>
                    <input value={creds[f.key as keyof typeof creds]}
                      onChange={e => setCreds(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Środowisko</label>
                  <select value={creds.env} onChange={e => setCreds(p => ({ ...p, env: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, outline: 'none' }}>
                    <option value="production">Produkcja</option>
                    <option value="sandbox">Sandbox (testy)</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setStep(2)} style={{ padding: '9px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Dalej →</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ maxWidth: 480 }}>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Podaj klucz API do raportowania eService:</p>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Klucz API (Reporting Key)</label>
                <input value={creds.apiKey}
                  onChange={e => setCreds(p => ({ ...p, apiKey: e.target.value }))}
                  placeholder="eS-rk-xxxxxxxxxxxxxxxxxxxxxxxx"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>Klucz znajdziesz w panelu eService → Ustawienia → API</p>
              </div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 12, color: '#92400e' }}>
                💡 Upewnij się, że włączyłeś dostęp API w panelu eService dla adresu IP serwera.
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setStep(1)} style={{ padding: '9px 16px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff' }}>← Wróć</button>
                <button onClick={() => setStep(3)} style={{ padding: '9px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Testuj →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ maxWidth: 480 }}>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Test połączenia z API eService i wykrywanie terminali:</p>
              {testResult === null && (
                <button onClick={testConnection} disabled={testing}
                  style={{ width: '100%', padding: '11px 0', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: testing ? 'not-allowed' : 'pointer', opacity: testing ? 0.7 : 1 }}>
                  {testing ? '⏳ Łączenie z eService...' : '🔌 Testuj połączenie i wykryj terminale'}
                </button>
              )}
              {testResult === 'ok' && (
                <div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#16a34a' }}>✅ Połączenie udane — wykryto 3 terminale!</p>
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {TERMINALE.map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, background: '#fff', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 10px' }}>
                          <span><strong>{t.id}</strong> — {t.sala}</span>
                          <span style={{ color: t.status === 'online' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{t.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => { setTab('dashboard') }}
                    style={{ width: '100%', padding: '11px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    ✓ Aktywuj integrację eService
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'dashboard' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Obrót kartą dziś',  val: `${obrot.toFixed(2)} zł`, color: '#2563EB' },
              { label: 'Transakcji',         val: dzis.length,               color: '#7C3AED' },
              { label: 'Zwroty',             val: `${zwroty.toFixed(2)} zł`, color: '#dc2626' },
              { label: 'Terminale online',   val: `${TERMINALE.filter(t => t.status === 'online').length}/${TERMINALE.length}`, color: '#16a34a' },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{k.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: '2px 0 0' }}>{k.val}</p>
              </div>
            ))}
          </div>

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

          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 13, fontWeight: 600, color: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Historia transakcji</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setTab('connect')} style={{ background: '#EFF6FF', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', color: '#2563EB', fontWeight: 600 }}>
                  ⚙️ Konfiguracja API
                </button>
                <button style={{ background: '#F3F4F6', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', color: '#374151' }}>Eksport CSV</button>
              </div>
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
        </>
      )}
    </div>
  )
}
