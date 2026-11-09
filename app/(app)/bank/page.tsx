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

const BANKI = [
  { id: 'pko',   name: 'PKO Bank Polski',    logo: '🏦' },
  { id: 'pekao', name: 'Bank Pekao',         logo: '🏛' },
  { id: 'mbank', name: 'mBank',              logo: '📱' },
  { id: 'ing',   name: 'ING Bank Śląski',    logo: '🦁' },
  { id: 'bnp',   name: 'BNP Paribas',        logo: '💚' },
  { id: 'other', name: 'Inny bank / API',    logo: '⚙️' },
]

export default function BankPage() {
  const [filter, setFilter] = useState<'wszystkie' | 'wpływ' | 'wydatek' | 'niedopasowane'>('wszystkie')
  const [tab, setTab] = useState<'dashboard' | 'connect'>('dashboard')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedBank, setSelectedBank] = useState('')
  const [creds, setCreds] = useState({ iban: '', apiKey: '', clientId: '', consent: false })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<null | 'ok' | 'err'>(null)
  const [wyciag, setWyciag] = useState(WYCIAG)

  const filtered = wyciag.filter(w => {
    if (filter === 'wpływ')        return w.typ === 'wpływ'
    if (filter === 'wydatek')      return w.typ === 'wydatek'
    if (filter === 'niedopasowane') return !w.dopasowane
    return true
  })

  const wplywy  = wyciag.filter(w => w.typ === 'wpływ').reduce((s, w) => s + w.kwota, 0)
  const wydatki = wyciag.filter(w => w.typ === 'wydatek').reduce((s, w) => s + Math.abs(w.kwota), 0)

  async function testConnection() {
    setTesting(true); setTestResult(null)
    await new Promise(r => setTimeout(r, 2200))
    setTestResult('ok'); setTesting(false)
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Integracja Bankowa</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Automatyczne pobieranie wyciągów — dopasowywanie płatności do faktur</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setTab('connect')}
            style={{ padding: '7px 14px', background: tab === 'connect' ? '#1e3a5f' : '#F3F4F6', color: tab === 'connect' ? '#fff' : '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            🔌 Skonfiguruj API
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#16a34a' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
            Bank API Połączony
          </div>
        </div>
      </div>

      {/* Konfiguracja */}
      {tab === 'connect' && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #F3F4F6' }}>
            {[{ n: 1, l: 'Wybierz bank' }, { n: 2, l: 'Dane dostępowe' }, { n: 3, l: 'Autoryzacja PSD2' }].map(s => (
              <div key={s.n} style={{ flex: 1, padding: '8px 0', textAlign: 'center', borderBottom: step === s.n ? '2px solid #2563EB' : '2px solid transparent', marginBottom: -2 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: step >= s.n ? '#2563EB' : '#E5E7EB', color: step >= s.n ? '#fff' : '#9CA3AF', fontSize: 12, fontWeight: 700, marginRight: 6 }}>{s.n}</span>
                <span style={{ fontSize: 13, fontWeight: step === s.n ? 600 : 400, color: step === s.n ? '#111827' : '#9CA3AF' }}>{s.l}</span>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Wybierz swój bank — integracja przez Open Banking (PSD2):</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
                {BANKI.map(b => (
                  <button key={b.id} onClick={() => setSelectedBank(b.id)}
                    style={{ padding: '14px 10px', border: `2px solid ${selectedBank === b.id ? '#2563EB' : '#E5E7EB'}`, borderRadius: 10, background: selectedBank === b.id ? '#EFF6FF' : '#fff', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{b.logo}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{b.name}</div>
                  </button>
                ))}
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1e40af', marginBottom: 16 }}>
                🔒 Połączenie przez Open Banking (PSD2) — bezpieczna autoryzacja bez podawania hasła do banku.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => selectedBank && setStep(2)} disabled={!selectedBank}
                  style={{ padding: '9px 20px', background: selectedBank ? '#2563EB' : '#E5E7EB', color: selectedBank ? '#fff' : '#9CA3AF', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: selectedBank ? 'pointer' : 'not-allowed' }}>
                  Dalej →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ maxWidth: 480 }}>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Podaj numer rachunku głównego:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Numer IBAN (rachunek firmowy)</label>
                  <input value={creds.iban} onChange={e => setCreds(p => ({ ...p, iban: e.target.value }))}
                    placeholder="PL61 1090 1014 0000 0712 1981 2874"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Client ID (Open Banking)</label>
                  <input value={creds.clientId} onChange={e => setCreds(p => ({ ...p, clientId: e.target.value }))}
                    placeholder="client_XXXXXXXXXXXX"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>API Key / Secret</label>
                  <input type="password" value={creds.apiKey} onChange={e => setCreds(p => ({ ...p, apiKey: e.target.value }))}
                    placeholder="••••••••••••••••••••••••"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setStep(1)} style={{ padding: '9px 16px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff' }}>← Wróć</button>
                <button onClick={() => setStep(3)} style={{ padding: '9px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Autoryzuj →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ maxWidth: 480 }}>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Ostatni krok — zaakceptuj zakres dostępu i przetestuj połączenie:</p>
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#111827' }}>Zakres dostępu (tylko do odczytu):</p>
                {['Pobieranie wyciągów bankowych', 'Odczyt historii transakcji (90 dni)', 'Sprawdzanie salda rachunku'].map(p => (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151', marginBottom: 5 }}>
                    <span style={{ color: '#16a34a' }}>✓</span> {p}
                  </div>
                ))}
                <div style={{ marginTop: 8, padding: '6px 10px', background: '#fef2f2', borderRadius: 6, fontSize: 11, color: '#dc2626' }}>
                  ✗ Brak dostępu do wykonywania przelewów
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151', cursor: 'pointer', marginBottom: 16 }}>
                <input type="checkbox" checked={creds.consent} onChange={e => setCreds(p => ({ ...p, consent: e.target.checked }))} />
                Akceptuję regulamin integracji bankowej HoReCa CRM
              </label>
              {testResult === null && (
                <button onClick={testConnection} disabled={testing || !creds.consent}
                  style={{ width: '100%', padding: '11px 0', background: creds.consent ? '#2563EB' : '#E5E7EB', color: creds.consent ? '#fff' : '#9CA3AF', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: (testing || !creds.consent) ? 'not-allowed' : 'pointer', opacity: testing ? 0.7 : 1 }}>
                  {testing ? '⏳ Autoryzacja PSD2...' : '🏦 Autoryzuj i połącz z bankiem'}
                </button>
              )}
              {testResult === 'ok' && (
                <div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#16a34a' }}>✅ Połączenie z bankiem aktywne!</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#166534' }}>Wyciągi będą pobierane automatycznie co 6 godzin.</p>
                  </div>
                  <button onClick={() => setTab('dashboard')}
                    style={{ width: '100%', padding: '11px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    ✓ Przejdź do wyciągów
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dashboard */}
      {tab === 'dashboard' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, auto)', gap: 12, marginBottom: 24, alignItems: 'start' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563EB 100%)', borderRadius: 12, padding: '20px 24px', color: '#fff' }}>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>Saldo bieżące</p>
              <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700 }}>{SALDO.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.6 }}>Rachunek główny — PKO Bank Polski</p>
            </div>
            {[
              { label: 'Wpływy (7 dni)', val: `+${wplywy.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł`, color: '#16a34a' },
              { label: 'Wydatki (7 dni)', val: `-${wydatki.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł`, color: '#dc2626' },
              { label: 'Niedopasowane', val: wyciag.filter(w => !w.dopasowane).length, color: '#d97706' },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px', minWidth: 150 }}>
                <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{k.label}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: k.color, margin: '2px 0 0' }}>{k.val}</p>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['wszystkie', 'wpływ', 'wydatek', 'niedopasowane'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', borderColor: filter === f ? '#2563EB' : '#E5E7EB', background: filter === f ? '#EFF6FF' : '#fff', color: filter === f ? '#2563EB' : '#374151', fontSize: 12, cursor: 'pointer', fontWeight: filter === f ? 600 : 400 }}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {f === 'niedopasowane' && <span style={{ marginLeft: 4, background: '#fef2f2', color: '#dc2626', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>{wyciag.filter(w => !w.dopasowane).length}</span>}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setTab('connect')} style={{ background: '#EFF6FF', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', color: '#2563EB', fontWeight: 600 }}>
                  ⚙️ Konfiguracja API
                </button>
                <button style={{ background: '#F3F4F6', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', color: '#374151' }}>Pobierz wyciąg</button>
              </div>
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
                        <button onClick={() => setWyciag(p => p.map(x => x.id === w.id ? { ...x, dopasowane: true } : x))}
                          style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                          Dopasuj ręcznie
                        </button>
                      )}
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
