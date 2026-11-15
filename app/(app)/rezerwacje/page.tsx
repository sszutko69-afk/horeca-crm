'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

type Status = 'potwierdzona' | 'oczekuje' | 'anulowana'

type Rezerwacja = {
  id: number
  godzina: string
  imie: string
  liczbaOsob: number
  stol: number
  status: Status
  telefon: string
  uwagi: string
  data: string
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function poniedzialek(d: Date) { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x }

const SCFG: Record<Status, { color: string; bg: string; label: string }> = {
  potwierdzona: { color: '#16a34a', bg: '#f0fdf4', label: 'Potwierdzona' },
  oczekuje:     { color: '#d97706', bg: '#fffbeb', label: 'Oczekuje' },
  anulowana:    { color: '#dc2626', bg: '#fef2f2', label: 'Anulowana' },
}

const emptyForm = () => ({ data: iso(new Date()), godzina: '12:00', imie: '', liczbaOsob: '2', stol: '0', telefon: '', uwagi: '', status: 'oczekuje' as Status })

const DAYS = ['Pon','Wt','Śr','Czw','Pt','Sob','Nie']

export default function RezerwacjePage() {
  const supabase = createClient()
  const dzis = iso(new Date())
  const [rez, setRez] = useState<Rezerwacja[]>([])
  const [stolyNumery, setStolyNumery] = useState<number[]>([])
  const [tydzien, setTydzien] = useState(poniedzialek(new Date()))
  const [selectedDate, setSelectedDate] = useState(dzis)
  const [filter, setFilter] = useState<'wszystkie' | Status>('wszystkie')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [toast, setToast] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const dniTygodnia = Array.from({ length: 7 }, (_, i) => { const d = new Date(tydzien); d.setDate(d.getDate() + i); return d })

  async function load() {
    const od = iso(dniTygodnia[0]); const do_ = iso(dniTygodnia[6])
    const { data, error } = await supabase.from('rezerwacje')
      .select('id,data,godzina,imie,liczba_osob,stol,status,telefon,uwagi').gte('data', od).lte('data', do_).order('godzina')
    if (error) { showToast('Błąd wczytywania: ' + error.message); setLoading(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRez((data ?? []).map((r: any) => ({ id: r.id, data: r.data, godzina: r.godzina, imie: r.imie, liczbaOsob: r.liczba_osob, stol: r.stol, status: r.status, telefon: r.telefon ?? '', uwagi: r.uwagi ?? '' })))
    setLoading(false)
  }
  useEffect(() => { load() }, [tydzien]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    supabase.from('stoly').select('numer').order('numer').then(({ data }) => setStolyNumery((data ?? []).map((x: { numer: number }) => x.numer)))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function zmienTydzien(delta: number) {
    const d = new Date(tydzien); d.setDate(d.getDate() + delta * 7)
    setTydzien(d); setSelectedDate(iso(d))
  }

  function openNew() {
    setEditId(null)
    setForm({ ...emptyForm(), data: selectedDate })
    setShowModal(true)
  }

  function openEdit(r: Rezerwacja) {
    setEditId(r.id)
    setForm({ data: r.data, godzina: r.godzina, imie: r.imie, liczbaOsob: String(r.liczbaOsob), stol: String(r.stol), telefon: r.telefon, uwagi: r.uwagi, status: r.status })
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      data: form.data, godzina: form.godzina, imie: form.imie.trim(),
      liczba_osob: parseInt(form.liczbaOsob) || 1, stol: parseInt(form.stol) || 0,
      telefon: form.telefon, uwagi: form.uwagi, status: form.status,
    }
    const { error } = editId
      ? await supabase.from('rezerwacje').update(payload).eq('id', editId)
      : await supabase.from('rezerwacje').insert(payload)
    if (error) { showToast('Nie udało się zapisać: ' + error.message); return }
    showToast(editId ? 'Rezerwacja zaktualizowana' : 'Rezerwacja dodana')
    setShowModal(false)
    await load()
  }

  async function handleDelete(id: number) {
    const { error } = await supabase.from('rezerwacje').delete().eq('id', id)
    setConfirmDelete(null)
    if (error) { showToast('Nie udało się usunąć: ' + error.message); return }
    showToast('Rezerwacja usunięta')
    await load()
  }

  async function changeStatus(id: number, status: Status) {
    const { error } = await supabase.from('rezerwacje').update({ status }).eq('id', id)
    if (error) { showToast('Nie udało się zmienić statusu: ' + error.message); return }
    setRez(p => p.map(r => r.id === id ? { ...r, status } : r))
    showToast(`Status zmieniony na: ${SCFG[status].label}`)
  }

  const rezDnia = rez.filter(r => r.data === selectedDate)
  const filtered = rezDnia.filter(r =>
    filter === 'wszystkie' ? true : r.status === filter
  ).sort((a, b) => a.godzina.localeCompare(b.godzina))

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#111827', color: '#fff', borderRadius: 8, padding: '10px 18px', fontSize: 13, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          ✓ {toast}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Rezerwacje stolików</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Zarządzanie rezerwacjami — {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button onClick={openNew} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Nowa rezerwacja
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Wszystkich', val: rezDnia.length, color: '#2563EB' },
          { label: 'Potwierdzonych', val: rezDnia.filter(r => r.status === 'potwierdzona').length, color: '#16a34a' },
          { label: 'Oczekuje', val: rezDnia.filter(r => r.status === 'oczekuje').length, color: '#d97706' },
          { label: 'Osób łącznie', val: rezDnia.filter(r => r.status !== 'anulowana').reduce((s, r) => s + r.liczbaOsob, 0), color: '#7C3AED' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: s.color, margin: '2px 0 0' }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Kalendarz tygodnia */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => zmienTydzien(-1)} aria-label="Poprzedni tydzień" style={{ border: '1px solid #E5E7EB', background: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>‹</button>
        {dniTygodnia.map((d, i) => {
          const dIso = iso(d)
          const isToday = dIso === dzis
          const isSel = dIso === selectedDate
          const ile = rez.filter(r => r.data === dIso && r.status !== 'anulowana').length
          return (
            <button key={dIso} onClick={() => setSelectedDate(dIso)}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', background: isSel ? '#2563EB' : isToday ? '#EFF6FF' : '#F9FAFB', color: isSel ? '#fff' : '#111827', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 600 }}>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{DAYS[i]}</span>
              <span>{d.getDate()}</span>
              <span style={{ fontSize: 10, opacity: isSel ? 0.9 : 0.5 }}>{ile > 0 ? `${ile} rez.` : '·'}</span>
            </button>
          )
        })}
        <button onClick={() => zmienTydzien(1)} aria-label="Następny tydzień" style={{ border: '1px solid #E5E7EB', background: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>›</button>
      </div>

      {/* Tabela */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['wszystkie', 'potwierdzona', 'oczekuje', 'anulowana'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', borderColor: filter === f ? '#2563EB' : '#E5E7EB', background: filter === f ? '#EFF6FF' : '#fff', color: filter === f ? '#2563EB' : '#374151', fontSize: 12, cursor: 'pointer', fontWeight: filter === f ? 600 : 400 }}>
                {f === 'wszystkie' ? 'Wszystkie' : SCFG[f as Status].label}
                {f !== 'wszystkie' && (
                  <span style={{ marginLeft: 4, background: SCFG[f as Status].bg, color: SCFG[f as Status].color, borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>
                    {rezDnia.filter(r => r.status === f).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: '#6B7280' }}>{filtered.length} rezerwacji</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Godzina', 'Klient / Firma', 'Osób', 'Stół', 'Telefon', 'Uwagi', 'Status', 'Akcje'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>{r.godzina}</td>
                  <td style={{ padding: '10px 14px', color: '#111827', fontWeight: 500 }}>{r.imie}</td>
                  <td style={{ padding: '10px 14px', color: '#374151', textAlign: 'center' }}>{r.liczbaOsob}</td>
                  <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{r.stol > 0 ? `Stół ${r.stol}` : '— cała sala'}</td>
                  <td style={{ padding: '10px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>{r.telefon}</td>
                  <td style={{ padding: '10px 14px', color: '#6B7280', fontStyle: r.uwagi ? 'normal' : 'italic', maxWidth: 160 }}>{r.uwagi || '—'}</td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <select
                      value={r.status}
                      onChange={e => changeStatus(r.id, e.target.value as Status)}
                      style={{ background: SCFG[r.status].bg, color: SCFG[r.status].color, border: `1px solid ${SCFG[r.status].color}44`, borderRadius: 20, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="potwierdzona">Potwierdzona</option>
                      <option value="oczekuje">Oczekuje</option>
                      <option value="anulowana">Anulowana</option>
                    </select>
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(r)} style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>Edytuj</button>
                      <button onClick={() => setConfirmDelete(r.id)} style={{ background: '#FEF2F2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>{loading ? 'Wczytywanie…' : 'Brak rezerwacji na ten dzień.'}</div>
        )}
      </div>

      {/* Modal — dodaj/edytuj */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editId ? 'Edytuj rezerwację' : 'Nowa rezerwacja'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Data</label>
                    <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} style={inp} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Godzina</label>
                    <input type="time" value={form.godzina} onChange={e => setForm(p => ({ ...p, godzina: e.target.value }))} style={inp} required />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Klient / Firma *</label>
                  <input value={form.imie} onChange={e => setForm(p => ({ ...p, imie: e.target.value }))} placeholder="Imię i nazwisko lub nazwa firmy" style={inp} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Liczba osób *</label>
                    <input type="number" min="1" max="100" value={form.liczbaOsob} onChange={e => setForm(p => ({ ...p, liczbaOsob: e.target.value }))} style={inp} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Stół</label>
                    <select value={form.stol} onChange={e => setForm(p => ({ ...p, stol: e.target.value }))} style={inp}>
                      <option value="0">— Cała sala</option>
                      {stolyNumery.filter(n => n > 0).map(n => <option key={n} value={n}>Stół {n}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Telefon</label>
                  <input value={form.telefon} onChange={e => setForm(p => ({ ...p, telefon: e.target.value }))} placeholder="600 100 200" style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Status }))} style={inp}>
                    <option value="oczekuje">Oczekuje</option>
                    <option value="potwierdzona">Potwierdzona</option>
                    <option value="anulowana">Anulowana</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Uwagi</label>
                  <textarea value={form.uwagi} onChange={e => setForm(p => ({ ...p, uwagi: e.target.value }))} placeholder="np. urodziny, alergia, specjalne życzenia..." rows={2} style={{ ...inp, resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#fff' }}>Anuluj</button>
                <button type="submit" style={{ padding: '8px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {editId ? 'Zapisz zmiany' : 'Dodaj rezerwację'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Potwierdzenie usunięcia */}
      {confirmDelete !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 360, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>Usuń rezerwację?</h3>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>Tej operacji nie można cofnąć.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '8px 16px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#fff' }}>Anuluj</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Usuń</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
