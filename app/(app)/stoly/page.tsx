'use client'

import { useState } from 'react'

type StolStatus = 'wolny' | 'zajety' | 'zarezerwowany' | 'nieaktywny'
type Ksztalt = 'kwadrat' | 'okragly'

type Stol = {
  id: number
  numer: number
  miejsca: number
  status: StolStatus
  x: number
  y: number
  ksztalt: Ksztalt
  kelner: string
  opis: string
}

const STATUS_CFG: Record<StolStatus, { color: string; bg: string; border: string; label: string }> = {
  wolny:         { color: '#16a34a', bg: '#f0fdf4', border: '#86efac', label: 'Wolny' },
  zajety:        { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', label: 'Zajęty' },
  zarezerwowany: { color: '#d97706', bg: '#fffbeb', border: '#fcd34d', label: 'Zarezerwowany' },
  nieaktywny:    { color: '#9CA3AF', bg: '#F3F4F6', border: '#D1D5DB', label: 'Nieaktywny' },
}

const INIT_STOŁY: Stol[] = [
  { id: 1,  numer: 1,  miejsca: 2, status: 'wolny',         x: 5,  y: 8,  ksztalt: 'okragly', kelner: '',         opis: 'Przy oknie' },
  { id: 2,  numer: 2,  miejsca: 2, status: 'zajety',        x: 20, y: 8,  ksztalt: 'okragly', kelner: 'Marta K.', opis: '' },
  { id: 3,  numer: 3,  miejsca: 4, status: 'zarezerwowany', x: 36, y: 8,  ksztalt: 'kwadrat', kelner: '',         opis: '' },
  { id: 4,  numer: 4,  miejsca: 4, status: 'wolny',         x: 55, y: 8,  ksztalt: 'kwadrat', kelner: '',         opis: 'VIP' },
  { id: 5,  numer: 5,  miejsca: 4, status: 'zajety',        x: 72, y: 8,  ksztalt: 'kwadrat', kelner: 'Tomek W.', opis: '' },
  { id: 6,  numer: 6,  miejsca: 6, status: 'wolny',         x: 5,  y: 38, ksztalt: 'kwadrat', kelner: '',         opis: '' },
  { id: 7,  numer: 7,  miejsca: 6, status: 'zarezerwowany', x: 26, y: 38, ksztalt: 'kwadrat', kelner: '',         opis: '' },
  { id: 8,  numer: 8,  miejsca: 2, status: 'zajety',        x: 50, y: 38, ksztalt: 'okragly', kelner: 'Ania S.',  opis: '' },
  { id: 9,  numer: 9,  miejsca: 2, status: 'wolny',         x: 65, y: 38, ksztalt: 'okragly', kelner: '',         opis: '' },
  { id: 10, numer: 10, miejsca: 8, status: 'zajety',        x: 5,  y: 65, ksztalt: 'kwadrat', kelner: 'Tomek W.', opis: 'Sala bankietowa' },
  { id: 11, numer: 11, miejsca: 4, status: 'wolny',         x: 42, y: 65, ksztalt: 'kwadrat', kelner: '',         opis: '' },
  { id: 12, numer: 12, miejsca: 6, status: 'zarezerwowany', x: 65, y: 65, ksztalt: 'kwadrat', kelner: '',         opis: '' },
  { id: 13, numer: 13, miejsca: 2, status: 'nieaktywny',    x: 85, y: 38, ksztalt: 'okragly', kelner: '',         opis: 'Remont' },
]

const ROZMIAR = (m: number) => m <= 2 ? 50 : m <= 4 ? 64 : m <= 6 ? 72 : 90

type RezForm = { godzina: string; imie: string; liczbaOsob: string; telefon: string; uwagi: string }
const emptyRez: RezForm = { godzina: '12:00', imie: '', liczbaOsob: '2', telefon: '', uwagi: '' }

type StolForm = { numer: string; miejsca: string; ksztalt: Ksztalt; status: StolStatus; kelner: string; opis: string; x: string; y: string }
const emptyStol: StolForm = { numer: '', miejsca: '4', ksztalt: 'kwadrat', status: 'wolny', kelner: '', opis: '', x: '10', y: '10' }

export default function StolyPage() {
  const [stoły, setStoły] = useState<Stol[]>(INIT_STOŁY)
  const [selected, setSelected] = useState<Stol | null>(null)
  const [mode, setMode] = useState<'view' | 'config'>('view')
  const [showRezModal, setShowRezModal] = useState(false)
  const [showStolModal, setShowStolModal] = useState(false)
  const [editStolId, setEditStolId] = useState<number | null>(null)
  const [rezForm, setRezForm] = useState<RezForm>(emptyRez)
  const [stolForm, setStolForm] = useState<StolForm>(emptyStol)
  const [toast, setToast] = useState('')
  const [confirmDeleteStol, setConfirmDeleteStol] = useState<number | null>(null)
  const [rezerwacje, setRezerwacje] = useState<{ stolId: number; imie: string; godzina: string }[]>([])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function changeStatus(id: number, status: StolStatus) {
    setStoły(p => p.map(s => s.id === id ? { ...s, status } : s))
    setSelected(p => p?.id === id ? { ...p, status } : p)
    showToast(`Status zmieniony: ${STATUS_CFG[status].label}`)
  }

  function openRez(stol: Stol) {
    setRezForm({ ...emptyRez, liczbaOsob: String(stol.miejsca) })
    setShowRezModal(true)
  }

  function handleRezSave(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setRezerwacje(p => [...p, { stolId: selected.id, imie: rezForm.imie, godzina: rezForm.godzina }])
    changeStatus(selected.id, 'zarezerwowany')
    setShowRezModal(false)
    showToast(`Rezerwacja ${rezForm.imie} na ${rezForm.godzina} — Stół ${selected.numer}`)
    setRezForm(emptyRez)
  }

  function openAddStol() {
    setEditStolId(null)
    const nextNr = Math.max(...stoły.map(s => s.numer), 0) + 1
    setStolForm({ ...emptyStol, numer: String(nextNr) })
    setShowStolModal(true)
  }

  function openEditStol(s: Stol) {
    setEditStolId(s.id)
    setStolForm({ numer: String(s.numer), miejsca: String(s.miejsca), ksztalt: s.ksztalt, status: s.status, kelner: s.kelner, opis: s.opis, x: String(s.x), y: String(s.y) })
    setShowStolModal(true)
  }

  function handleStolSave(e: React.FormEvent) {
    e.preventDefault()
    const payload: Stol = {
      id: editStolId ?? Date.now(),
      numer: parseInt(stolForm.numer) || stoły.length + 1,
      miejsca: parseInt(stolForm.miejsca) || 4,
      status: stolForm.status,
      x: Math.min(85, Math.max(1, parseFloat(stolForm.x) || 10)),
      y: Math.min(80, Math.max(5, parseFloat(stolForm.y) || 10)),
      ksztalt: stolForm.ksztalt,
      kelner: stolForm.kelner,
      opis: stolForm.opis,
    }
    if (editStolId) {
      setStoły(p => p.map(s => s.id === editStolId ? payload : s))
      setSelected(payload)
      showToast('Stół zaktualizowany')
    } else {
      setStoły(p => [...p, payload])
      showToast(`Stół ${payload.numer} dodany`)
    }
    setShowStolModal(false)
  }

  function handleDeleteStol(id: number) {
    setStoły(p => p.filter(s => s.id !== id))
    setSelected(null)
    setConfirmDeleteStol(null)
    showToast('Stół usunięty')
  }

  const summary = {
    wolne:  stoły.filter(s => s.status === 'wolny').length,
    zajete: stoły.filter(s => s.status === 'zajety').length,
    rez:    stoły.filter(s => s.status === 'zarezerwowany').length,
    miejsca: stoły.filter(s => s.status !== 'nieaktywny').reduce((s, t) => s + t.miejsca, 0),
  }

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#111827', color: '#fff', borderRadius: 8, padding: '10px 18px', fontSize: 13, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          ✓ {toast}
        </div>
      )}

      {/* Nagłówek */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Plan sali — Stoły</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Interaktywny widok rozmieszczenia i zarządzanie stolikami</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode(m => m === 'view' ? 'config' : 'view')}
            style={{ padding: '8px 16px', background: mode === 'config' ? '#7C3AED' : '#F3F4F6', color: mode === 'config' ? '#fff' : '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {mode === 'config' ? '✓ Zakończ konfigurację' : '⚙️ Konfiguruj stoły'}
          </button>
          {mode === 'config' && (
            <button onClick={openAddStol} style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Dodaj stół
            </button>
          )}
        </div>
      </div>

      {mode === 'config' && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
          ⚙️ <strong>Tryb konfiguracji</strong> — kliknij stół aby go edytować lub usunąć. Możesz dodawać nowe stoły, zmieniać ich rozmiar, kształt i pozycję.
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { label: 'Wolne', val: summary.wolne, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Zajęte', val: summary.zajete, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Zarezerwowane', val: summary.rez, color: '#d97706', bg: '#fffbeb' },
          { label: 'Miejsc łącznie', val: summary.miejsca, color: '#2563EB', bg: '#EFF6FF' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.color}33`, borderRadius: 10, padding: '10px 18px', minWidth: 120 }}>
            <p style={{ fontSize: 11, color: k.color, margin: 0, fontWeight: 600 }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: '1px 0 0' }}>{k.val}</p>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151' }}>
              <span style={{ width: 10, height: 10, borderRadius: k === 'wolny' || k === 'nieaktywny' ? '50%' : 2, background: v.color, flexShrink: 0 }} />
              {v.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 300px' : '1fr', gap: 20 }}>
        {/* Plan sali */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>🏠 Sala główna</span>
            <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>Kliknij stół aby zobaczyć szczegóły</span>
          </div>
          <div style={{ position: 'relative', height: 440, background: '#FAFAFA', backgroundImage: 'linear-gradient(#E5E7EB 1px, transparent 1px), linear-gradient(90deg, #E5E7EB 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            <div style={{ position: 'absolute', bottom: 10, left: '45%', background: '#374151', color: '#fff', fontSize: 10, padding: '3px 10px', borderRadius: 4 }}>WEJŚCIE</div>
            <div style={{ position: 'absolute', top: 10, right: 10, background: '#7C3AED', color: '#fff', fontSize: 10, padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>BAR</div>
            <div style={{ position: 'absolute', top: 10, left: 10, background: '#0891b2', color: '#fff', fontSize: 10, padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>KUCHNIA →</div>

            {stoły.map(stol => {
              const cfg = STATUS_CFG[stol.status]
              const isRound = stol.ksztalt === 'okragly'
              const isSelected = selected?.id === stol.id
              const size = ROZMIAR(stol.miejsca)
              return (
                <button key={stol.id}
                  onClick={() => setSelected(isSelected ? null : stol)}
                  style={{
                    position: 'absolute',
                    left: `${stol.x}%`, top: `${stol.y}%`,
                    width: size, height: size,
                    borderRadius: isRound ? '50%' : 10,
                    background: cfg.bg,
                    border: `2px solid ${isSelected ? '#2563EB' : cfg.border}`,
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isSelected ? '0 0 0 3px #BFDBFE' : '0 2px 4px rgba(0,0,0,0.08)',
                    transition: 'all 120ms',
                    color: cfg.color, fontSize: 11, fontWeight: 700, zIndex: isSelected ? 10 : 1,
                    transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                  }}
                  title={`Stół ${stol.numer} — ${stol.miejsca} miejsca — ${cfg.label}${stol.opis ? ` — ${stol.opis}` : ''}`}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{stol.numer}</span>
                  <span style={{ fontSize: 9, opacity: 0.8 }}>{stol.miejsca}os</span>
                  {stol.kelner && <span style={{ fontSize: 7, opacity: 0.6, marginTop: 1, maxWidth: size - 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{stol.kelner}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Panel szczegółów */}
        {selected && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Stół {selected.numer}</h3>
                {selected.opis && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280' }}>{selected.opis}</p>}
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9CA3AF', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6B7280' }}>Status</span>
                <select value={selected.status} onChange={e => changeStatus(selected.id, e.target.value as StolStatus)}
                  style={{ background: STATUS_CFG[selected.status].bg, color: STATUS_CFG[selected.status].color, border: `1px solid ${STATUS_CFG[selected.status].border}`, borderRadius: 20, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                  <option value="wolny">Wolny</option>
                  <option value="zajety">Zajęty</option>
                  <option value="zarezerwowany">Zarezerwowany</option>
                  <option value="nieaktywny">Nieaktywny</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Miejsc</span>
                <strong>{selected.miejsca}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Kształt</span>
                <strong>{selected.ksztalt === 'okragly' ? 'Okrągły' : 'Prostokątny'}</strong>
              </div>
              {selected.kelner && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6B7280' }}>Kelner</span>
                  <strong>{selected.kelner}</strong>
                </div>
              )}
              {rezerwacje.filter(r => r.stolId === selected.id).length > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 10px' }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#92400e' }}>Rezerwacje dziś:</p>
                  {rezerwacje.filter(r => r.stolId === selected.id).map((r, i) => (
                    <p key={i} style={{ margin: '2px 0 0', fontSize: 11, color: '#78350f' }}>{r.godzina} — {r.imie}</p>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.status !== 'nieaktywny' && (
                <button onClick={() => openRez(selected)}
                  style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  📅 Nowa rezerwacja
                </button>
              )}
              {mode === 'config' && (
                <>
                  <button onClick={() => openEditStol(selected)}
                    style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                    ✏️ Edytuj stół
                  </button>
                  <button onClick={() => setConfirmDeleteStol(selected.id)}
                    style={{ background: '#FEF2F2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer' }}>
                    🗑 Usuń stół
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lista stołów (tryb config) */}
      {mode === 'config' && (
        <div style={{ marginTop: 20, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 13, fontWeight: 600, color: '#374151' }}>Lista stołów</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Nr', 'Miejsca', 'Kształt', 'Pozycja (x,y)', 'Kelner', 'Opis', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stoły.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700 }}>Stół {s.numer}</td>
                    <td style={{ padding: '8px 12px' }}>{s.miejsca}</td>
                    <td style={{ padding: '8px 12px' }}>{s.ksztalt === 'okragly' ? 'Okrągły' : 'Prostokątny'}</td>
                    <td style={{ padding: '8px 12px', color: '#6B7280', fontFamily: 'monospace' }}>x:{s.x}% y:{s.y}%</td>
                    <td style={{ padding: '8px 12px', color: '#6B7280' }}>{s.kelner || '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#6B7280' }}>{s.opis || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ background: STATUS_CFG[s.status].bg, color: STATUS_CFG[s.status].color, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                        {STATUS_CFG[s.status].label}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { setSelected(s); openEditStol(s) }} style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>Edytuj</button>
                        <button onClick={() => setConfirmDeleteStol(s.id)} style={{ background: '#FEF2F2', color: '#dc2626', border: 'none', borderRadius: 5, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal — nowa rezerwacja */}
      {showRezModal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nowa rezerwacja</h2>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>Stół {selected.numer} · {selected.miejsca} miejsca</p>
              </div>
              <button onClick={() => setShowRezModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
            </div>
            <form onSubmit={handleRezSave}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Gość / Firma *</label>
                  <input value={rezForm.imie} onChange={e => setRezForm(p => ({ ...p, imie: e.target.value }))} placeholder="Imię i nazwisko" style={inp} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Godzina *</label>
                    <input type="time" value={rezForm.godzina} onChange={e => setRezForm(p => ({ ...p, godzina: e.target.value }))} style={inp} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Liczba osób</label>
                    <input type="number" min="1" max={selected.miejsca} value={rezForm.liczbaOsob} onChange={e => setRezForm(p => ({ ...p, liczbaOsob: e.target.value }))} style={inp} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Telefon</label>
                  <input value={rezForm.telefon} onChange={e => setRezForm(p => ({ ...p, telefon: e.target.value }))} placeholder="600 100 200" style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Uwagi</label>
                  <textarea value={rezForm.uwagi} onChange={e => setRezForm(p => ({ ...p, uwagi: e.target.value }))} placeholder="np. urodziny, alergie..." rows={2} style={{ ...inp, resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowRezModal(false)} style={{ padding: '8px 16px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#fff' }}>Anuluj</button>
                <button type="submit" style={{ padding: '8px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Zarezerwuj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — dodaj/edytuj stół */}
      {showStolModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editStolId ? 'Edytuj stół' : 'Dodaj nowy stół'}</h2>
              <button onClick={() => setShowStolModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
            </div>
            <form onSubmit={handleStolSave}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Numer stołu *</label>
                    <input type="number" min="1" value={stolForm.numer} onChange={e => setStolForm(p => ({ ...p, numer: e.target.value }))} style={inp} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Liczba miejsc *</label>
                    <input type="number" min="1" max="20" value={stolForm.miejsca} onChange={e => setStolForm(p => ({ ...p, miejsca: e.target.value }))} style={inp} required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Kształt</label>
                    <select value={stolForm.ksztalt} onChange={e => setStolForm(p => ({ ...p, ksztalt: e.target.value as Ksztalt }))} style={inp}>
                      <option value="kwadrat">Prostokątny</option>
                      <option value="okragly">Okrągły</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Status</label>
                    <select value={stolForm.status} onChange={e => setStolForm(p => ({ ...p, status: e.target.value as StolStatus }))} style={inp}>
                      <option value="wolny">Wolny</option>
                      <option value="zajety">Zajęty</option>
                      <option value="zarezerwowany">Zarezerwowany</option>
                      <option value="nieaktywny">Nieaktywny</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Pozycja X (1–85%)</label>
                    <input type="number" min="1" max="85" value={stolForm.x} onChange={e => setStolForm(p => ({ ...p, x: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Pozycja Y (5–80%)</label>
                    <input type="number" min="5" max="80" value={stolForm.y} onChange={e => setStolForm(p => ({ ...p, y: e.target.value }))} style={inp} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Kelner</label>
                  <input value={stolForm.kelner} onChange={e => setStolForm(p => ({ ...p, kelner: e.target.value }))} placeholder="np. Marta K." style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Opis / lokalizacja</label>
                  <input value={stolForm.opis} onChange={e => setStolForm(p => ({ ...p, opis: e.target.value }))} placeholder="np. Przy oknie, Sala VIP" style={inp} />
                </div>
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowStolModal(false)} style={{ padding: '8px 16px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#fff' }}>Anuluj</button>
                <button type="submit" style={{ padding: '8px 20px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {editStolId ? 'Zapisz zmiany' : 'Dodaj stół'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Potwierdzenie usunięcia stołu */}
      {confirmDeleteStol !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 360, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>Usuń stół?</h3>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>Stół {stoły.find(s => s.id === confirmDeleteStol)?.numer} zostanie usunięty z planu sali.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDeleteStol(null)} style={{ padding: '8px 16px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#fff' }}>Anuluj</button>
              <button onClick={() => handleDeleteStol(confirmDeleteStol)} style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Usuń</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
