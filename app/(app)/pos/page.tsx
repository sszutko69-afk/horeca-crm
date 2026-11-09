'use client'

import { useState } from 'react'

const TRANSAKCJE_DEMO = [
  { id: 'T-0892', czas: '14:32', stol: 5,  kwota: 186.50, metoda: 'karta',    status: 'rozliczone', kelner: 'Marta K.' },
  { id: 'T-0891', czas: '14:18', stol: 2,  kwota:  54.00, metoda: 'gotówka',  status: 'rozliczone', kelner: 'Tomek W.' },
  { id: 'T-0890', czas: '13:55', stol: 7,  kwota: 312.00, metoda: 'karta',    status: 'rozliczone', kelner: 'Ania S.'  },
  { id: 'T-0889', czas: '13:40', stol: 10, kwota:  76.00, metoda: 'terminal', status: 'rozliczone', kelner: 'Marta K.' },
  { id: 'T-0888', czas: '12:55', stol: 3,  kwota:  44.50, metoda: 'gotówka',  status: 'rozliczone', kelner: 'Tomek W.' },
  { id: 'T-0887', czas: '12:30', stol: 8,  kwota: 228.00, metoda: 'karta',    status: 'rozliczone', kelner: 'Ania S.'  },
]

const PRODUKTY = [
  { nazwa: 'Kotlet schabowy',  ilosc: 24, kwota: 1152 },
  { nazwa: 'Łosoś grillowany', ilosc: 18, kwota: 1224 },
  { nazwa: 'Pierogi ruskie',   ilosc: 31, kwota:  992 },
  { nazwa: 'Tiramisu',         ilosc: 42, kwota: 1008 },
  { nazwa: 'Kawa espresso',    ilosc: 87, kwota:  870 },
]

const POS_SYSTEMS = [
  { id: 'posbistro', name: 'POSbistro', logo: '🍽', desc: 'Najpopularniejszy system POS dla restauracji w Polsce' },
  { id: 'gastropos',  name: 'Gastro POS', logo: '🧑‍🍳', desc: 'Zaawansowany system zarządzania restauracją' },
  { id: 'restaumatic',name: 'Restaumatic', logo: '📱', desc: 'Zintegrowane zamawianie online + POS' },
  { id: 'custom',     name: 'Własny / inny', logo: '⚙️', desc: 'Integracja przez REST API' },
]

export default function PosPage() {
  const [tab, setTab] = useState<'dashboard' | 'connect'>('dashboard')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedPos, setSelectedPos] = useState('')
  const [creds, setCreds] = useState({ endpoint: '', apiKey: '', merchantId: '' })
  const [testing, setTesting] = useState(false)
  const [connected, setConnected] = useState(true)
  const [testResult, setTestResult] = useState<null | 'ok' | 'err'>(null)

  const obroty = TRANSAKCJE_DEMO.reduce((s, t) => s + t.kwota, 0)

  async function testConnection() {
    setTesting(true); setTestResult(null)
    await new Promise(r => setTimeout(r, 1800))
    setTestResult('ok'); setTesting(false)
  }

  function finishSetup() {
    setConnected(true); setTab('dashboard'); setStep(1)
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Integracja POS</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Synchronizacja z systemem punktu sprzedaży — transakcje, paragon i stany magazynowe</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('connect')}
            style={{ padding: '7px 14px', background: tab === 'connect' ? '#1e3a5f' : '#F3F4F6', color: tab === 'connect' ? '#fff' : '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            🔌 Skonfiguruj API
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: connected ? '#f0fdf4' : '#fef2f2', border: `1px solid ${connected ? '#86efac' : '#fca5a5'}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: connected ? '#16a34a' : '#dc2626' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#16a34a' : '#dc2626', display: 'inline-block', animation: connected ? 'pulse 2s infinite' : 'none' }} />
            {connected ? 'POS Połączony' : 'Rozłączony'}
          </div>
        </div>
      </div>

      {/* Zakładka: Konfiguracja */}
      {tab === 'connect' && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #F3F4F6' }}>
            {[{ n: 1, l: 'Wybierz system' }, { n: 2, l: 'Dane API' }, { n: 3, l: 'Test i aktywacja' }].map(s => (
              <div key={s.n} style={{ flex: 1, padding: '8px 0', textAlign: 'center', borderBottom: step === s.n ? '2px solid #2563EB' : '2px solid transparent', marginBottom: -2 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: step >= s.n ? '#2563EB' : '#E5E7EB', color: step >= s.n ? '#fff' : '#9CA3AF', fontSize: 12, fontWeight: 700, marginRight: 6 }}>{s.n}</span>
                <span style={{ fontSize: 13, fontWeight: step === s.n ? 600 : 400, color: step === s.n ? '#111827' : '#9CA3AF' }}>{s.l}</span>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Wybierz system POS, z którym chcesz zintegrować HoReCa CRM:</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {POS_SYSTEMS.map(s => (
                  <button key={s.id} onClick={() => setSelectedPos(s.id)}
                    style={{ padding: 16, border: `2px solid ${selectedPos === s.id ? '#2563EB' : '#E5E7EB'}`, borderRadius: 10, background: selectedPos === s.id ? '#EFF6FF' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{s.logo}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{s.desc}</div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => selectedPos && setStep(2)} disabled={!selectedPos}
                  style={{ padding: '9px 20px', background: selectedPos ? '#2563EB' : '#E5E7EB', color: selectedPos ? '#fff' : '#9CA3AF', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: selectedPos ? 'pointer' : 'not-allowed' }}>
                  Dalej →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ maxWidth: 480 }}>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Wprowadź dane dostępowe do API systemu <strong>{POS_SYSTEMS.find(s => s.id === selectedPos)?.name}</strong>:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Adres endpoint API', key: 'endpoint', placeholder: 'https://api.twojpos.pl/v2' },
                  { label: 'Klucz API (API Key)', key: 'apiKey', placeholder: 'sk-xxxxxxxx-xxxx-xxxx' },
                  { label: 'ID lokalu / Merchant ID', key: 'merchantId', placeholder: 'REST-00123' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{f.label}</label>
                    <input value={creds[f.key as keyof typeof creds]}
                      onChange={e => setCreds(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginTop: 16, fontSize: 12, color: '#166534' }}>
                🔒 Dane API są szyfrowane (AES-256) i przechowywane wyłącznie na Twoim koncie.
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setStep(1)} style={{ padding: '9px 16px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff' }}>← Wróć</button>
                <button onClick={() => setStep(3)} style={{ padding: '9px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Testuj połączenie →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ maxWidth: 480 }}>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Gotowe do testu. Kliknij aby zweryfikować połączenie z API POS.</p>
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#6B7280', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><span style={{ opacity: 0.6 }}>System:</span> <strong>{POS_SYSTEMS.find(s => s.id === selectedPos)?.name}</strong></div>
                  <div><span style={{ opacity: 0.6 }}>Endpoint:</span> <strong style={{ wordBreak: 'break-all' }}>{creds.endpoint || 'pos.demo.local:8080'}</strong></div>
                  <div><span style={{ opacity: 0.6 }}>Merchant ID:</span> <strong>{creds.merchantId || 'REST-00123'}</strong></div>
                  <div><span style={{ opacity: 0.6 }}>Tryb sync:</span> <strong>Automatyczny (60s)</strong></div>
                </div>
              </div>
              {testResult === null && (
                <button onClick={testConnection} disabled={testing}
                  style={{ width: '100%', padding: '11px 0', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: testing ? 'not-allowed' : 'pointer', opacity: testing ? 0.7 : 1 }}>
                  {testing ? '⏳ Testowanie połączenia...' : '🔌 Testuj połączenie'}
                </button>
              )}
              {testResult === 'ok' && (
                <div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#16a34a' }}>✅ Połączenie udane!</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#166534' }}>API odpowiada poprawnie. Synchronizacja zostanie uruchomiona po aktywacji.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setTestResult(null); setStep(2) }} style={{ flex: 1, padding: '9px 16px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff' }}>← Popraw dane</button>
                    <button onClick={finishSetup} style={{ flex: 2, padding: '9px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✓ Aktywuj integrację POS</button>
                  </div>
                </div>
              )}
              {testResult === 'err' && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#dc2626' }}>❌ Błąd połączenia</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#991b1b' }}>Sprawdź endpoint i klucz API, a następnie spróbuj ponownie.</p>
                  <button onClick={() => { setTestResult(null); setStep(2) }} style={{ marginTop: 10, padding: '7px 14px', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#fff', color: '#dc2626' }}>← Popraw dane</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dashboard POS */}
      {tab === 'dashboard' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Obrót dziś',  val: `${obroty.toFixed(0)} zł`, color: '#2563EB' },
              { label: 'Transakcji',  val: TRANSAKCJE_DEMO.length,       color: '#7C3AED' },
              { label: 'Karta',       val: TRANSAKCJE_DEMO.filter(t => t.metoda === 'karta').length, color: '#16a34a' },
              { label: 'Gotówka',     val: TRANSAKCJE_DEMO.filter(t => t.metoda === 'gotówka').length, color: '#d97706' },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{k.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: '2px 0 0' }}>{k.val}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 13, fontWeight: 600, color: '#111827' }}>Ostatnie transakcje</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {['ID', 'Czas', 'Stół', 'Kwota', 'Metoda', 'Kelner'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TRANSAKCJE_DEMO.map((t, i) => (
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

            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', alignSelf: 'flex-start' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 13, fontWeight: 600, color: '#111827' }}>Bestsellery dziś</div>
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

          <div style={{ marginTop: 20, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Konfiguracja POS</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13 }}>
              <div><span style={{ color: '#6B7280' }}>System:</span> <strong>POSbistro v4.2</strong></div>
              <div><span style={{ color: '#6B7280' }}>Endpoint:</span> <strong>pos.demo.local:8080</strong></div>
              <div><span style={{ color: '#6B7280' }}>Ostatnia sync:</span> <strong>przed chwilą</strong></div>
              <div><span style={{ color: '#6B7280' }}>Tryb:</span> <strong>Automatyczny (60s)</strong></div>
            </div>
            <button onClick={() => setTab('connect')} style={{ marginTop: 12, padding: '7px 14px', background: '#F3F4F6', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#374151' }}>
              ✏️ Zmień konfigurację
            </button>
          </div>
        </>
      )}
    </div>
  )
}
