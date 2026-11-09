'use client'

import { useState } from 'react'

type Danie = {
  id: number
  nazwa: string
  kategoria: string
  cena: number
  dostepne: boolean
  alergeny: string[]
  kcal: number
  opis: string
}

const INIT_MENU: Danie[] = [
  { id: 1,  nazwa: 'Żurek staropolski',           kategoria: 'Zupy',         cena: 22, dostepne: true,  alergeny: ['gluten', 'jajka', 'mleko'], kcal: 310, opis: 'Podawany w chlebie, z jajkiem i białą kiełbasą' },
  { id: 2,  nazwa: 'Zupa pomidorowa z ryżem',     kategoria: 'Zupy',         cena: 18, dostepne: true,  alergeny: ['gluten'],                   kcal: 220, opis: '' },
  { id: 3,  nazwa: 'Sałatka grecka',              kategoria: 'Sałatki',      cena: 28, dostepne: true,  alergeny: ['mleko'],                    kcal: 280, opis: 'Feta, oliwki, ogórek, pomidor' },
  { id: 4,  nazwa: 'Carpaccio z wołowiny',        kategoria: 'Przystawki',   cena: 42, dostepne: true,  alergeny: ['jajka', 'mleko'],           kcal: 180, opis: 'Z parmezanem i rukolą' },
  { id: 5,  nazwa: 'Pierogi ruskie',              kategoria: 'Dania główne', cena: 32, dostepne: true,  alergeny: ['gluten', 'mleko'],          kcal: 480, opis: '8 sztuk, z cebulą i śmietaną' },
  { id: 6,  nazwa: 'Kotlet schabowy z buraczkami',kategoria: 'Dania główne', cena: 48, dostepne: true,  alergeny: ['gluten', 'jajka'],          kcal: 650, opis: 'Z ziemniakami i surówką' },
  { id: 7,  nazwa: 'Łosoś grillowany',            kategoria: 'Dania główne', cena: 68, dostepne: true,  alergeny: ['ryby'],                     kcal: 420, opis: 'Z warzywami i sosem cytrynowym' },
  { id: 8,  nazwa: 'Risotto z grzybami',          kategoria: 'Dania główne', cena: 52, dostepne: false, alergeny: ['mleko'],                    kcal: 540, opis: 'Z truflową śmietaną i parmezanem' },
  { id: 9,  nazwa: 'Tiramisu',                    kategoria: 'Desery',       cena: 24, dostepne: true,  alergeny: ['gluten', 'jajka', 'mleko'], kcal: 390, opis: 'Klasyczny włoski deser' },
  { id: 10, nazwa: 'Sernik nowojorski',            kategoria: 'Desery',       cena: 22, dostepne: true,  alergeny: ['gluten', 'jajka', 'mleko'], kcal: 420, opis: 'Z sosem truskawkowym' },
  { id: 11, nazwa: 'Kawa espresso',               kategoria: 'Napoje',       cena: 10, dostepne: true,  alergeny: [],                           kcal: 5,   opis: '' },
  { id: 12, nazwa: 'Lemonade własna',             kategoria: 'Napoje',       cena: 14, dostepne: true,  alergeny: [],                           kcal: 90,  opis: 'Mięta, cytryna, miód' },
]

const WSZYSTKIE_KAT = ['Zupy', 'Sałatki', 'Przystawki', 'Dania główne', 'Desery', 'Napoje']

const ALERGEN_COLOR: Record<string, string> = {
  gluten: '#F59E0B', jajka: '#10B981', mleko: '#3B82F6',
  ryby: '#8B5CF6', orzechy: '#EF4444', soja: '#6366f1',
}

const ALERGEN_OPCJE = ['gluten', 'jajka', 'mleko', 'ryby', 'orzechy', 'soja', 'seler', 'gorczyca']

type DanieForm = {
  nazwa: string; kategoria: string; cena: string; kcal: string
  opis: string; dostepne: boolean; alergeny: string[]
}

const emptyForm: DanieForm = {
  nazwa: '', kategoria: 'Dania główne', cena: '', kcal: '', opis: '', dostepne: true, alergeny: [],
}

export default function MenuPage() {
  const [menu, setMenu] = useState<Danie[]>(INIT_MENU)
  const [kat, setKat] = useState('Wszystkie')
  const [showUnavail, setShowUnavail] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<DanieForm>(emptyForm)
  const [toast, setToast] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const kategorie = ['Wszystkie', ...WSZYSTKIE_KAT]

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function openAdd() {
    setEditId(null); setForm(emptyForm); setShowModal(true)
  }

  function openEdit(d: Danie) {
    setEditId(d.id)
    setForm({ nazwa: d.nazwa, kategoria: d.kategoria, cena: String(d.cena), kcal: String(d.kcal), opis: d.opis, dostepne: d.dostepne, alergeny: [...d.alergeny] })
    setShowModal(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const payload: Danie = {
      id: editId ?? Date.now(),
      nazwa: form.nazwa,
      kategoria: form.kategoria,
      cena: parseFloat(form.cena) || 0,
      kcal: parseInt(form.kcal) || 0,
      opis: form.opis,
      dostepne: form.dostepne,
      alergeny: form.alergeny,
    }
    if (editId) {
      setMenu(p => p.map(d => d.id === editId ? payload : d))
      showToast('Danie zaktualizowane')
    } else {
      setMenu(p => [...p, payload])
      showToast(`Dodano: ${payload.nazwa}`)
    }
    setShowModal(false)
  }

  function toggleDostepne(id: number) {
    setMenu(p => p.map(d => d.id === id ? { ...d, dostepne: !d.dostepne } : d))
  }

  function handleDelete(id: number) {
    setMenu(p => p.filter(d => d.id !== id))
    setConfirmDelete(null)
    showToast('Danie usunięte')
  }

  function toggleAlergen(a: string) {
    setForm(p => ({
      ...p,
      alergeny: p.alergeny.includes(a) ? p.alergeny.filter(x => x !== a) : [...p.alergeny, a],
    }))
  }

  const filtered = menu.filter(d =>
    (kat === 'Wszystkie' || d.kategoria === kat) &&
    (showUnavail || d.dostepne) &&
    (search === '' || d.nazwa.toLowerCase().includes(search.toLowerCase()))
  )

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#111827', color: '#fff', borderRadius: 8, padding: '10px 18px', fontSize: 13, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          ✓ {toast}
        </div>
      )}

      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Menu & Dania</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Zarządzanie kartą menu, cenami i dostępnością · {menu.length} pozycji</p>
        </div>
        <button onClick={openAdd} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Dodaj danie
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Pozycji łącznie', val: menu.length, color: '#2563EB' },
          { label: 'Dostępnych', val: menu.filter(d => d.dostepne).length, color: '#16a34a' },
          { label: 'Niedostępnych', val: menu.filter(d => !d.dostepne).length, color: '#dc2626' },
          { label: 'Śr. cena', val: `${(menu.reduce((s, d) => s + d.cena, 0) / menu.length).toFixed(0)} zł`, color: '#7C3AED' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{k.label}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: k.color, margin: '1px 0 0' }}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Filtry */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {kategorie.map(k => (
          <button key={k} onClick={() => setKat(k)} style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', borderColor: kat === k ? '#2563EB' : '#E5E7EB', background: kat === k ? '#EFF6FF' : '#fff', color: kat === k ? '#2563EB' : '#374151', fontSize: 12, cursor: 'pointer', fontWeight: kat === k ? 600 : 400 }}>
            {k} {k !== 'Wszystkie' && <span style={{ opacity: 0.6 }}>({menu.filter(d => d.kategoria === k).length})</span>}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Szukaj dania..." style={{ padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 20, fontSize: 12, outline: 'none', marginLeft: 8 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
          <input type="checkbox" checked={showUnavail} onChange={e => setShowUnavail(e.target.checked)} />
          Pokaż niedostępne
        </label>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {filtered.map(danie => (
          <div key={danie.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, opacity: danie.dostepne ? 1 : 0.6, position: 'relative' }}>
            {!danie.dostepne && (
              <span style={{ position: 'absolute', top: 10, right: 10, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>NIEDOSTĘPNE</span>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#111827' }}>{danie.nazwa}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9CA3AF' }}>{danie.kategoria}</p>
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#2563EB', whiteSpace: 'nowrap', marginLeft: 8 }}>{danie.cena} zł</span>
            </div>
            {danie.opis && <p style={{ margin: '4px 0 8px', fontSize: 12, color: '#6B7280' }}>{danie.opis}</p>}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              {danie.alergeny.map(a => (
                <span key={a} style={{ background: `${ALERGEN_COLOR[a] || '#E5E7EB'}22`, color: ALERGEN_COLOR[a] || '#374151', border: `1px solid ${ALERGEN_COLOR[a] || '#E5E7EB'}44`, fontSize: 10, padding: '2px 7px', borderRadius: 20 }}>
                  {a}
                </span>
              ))}
              {danie.kcal > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }}>{danie.kcal} kcal</span>}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <button onClick={() => openEdit(danie)} style={{ flex: 1, background: '#EFF6FF', border: 'none', borderRadius: 6, padding: '6px', fontSize: 11, cursor: 'pointer', color: '#2563EB', fontWeight: 500 }}>✏️ Edytuj</button>
              <button onClick={() => toggleDostepne(danie.id)} style={{ flex: 1, background: danie.dostepne ? '#fef2f2' : '#f0fdf4', border: 'none', borderRadius: 6, padding: '6px', fontSize: 11, cursor: 'pointer', color: danie.dostepne ? '#dc2626' : '#16a34a', fontWeight: 500 }}>
                {danie.dostepne ? '⊘ Wyłącz' : '✓ Włącz'}
              </button>
              <button onClick={() => setConfirmDelete(danie.id)} style={{ background: '#FEF2F2', border: 'none', borderRadius: 6, padding: '6px 8px', fontSize: 11, cursor: 'pointer', color: '#dc2626' }}>🗑</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Brak dań dla wybranego filtra.</div>
        )}
      </div>

      {/* Modal — dodaj/edytuj */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editId ? 'Edytuj danie' : 'Nowe danie'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Nazwa dania *</label>
                  <input value={form.nazwa} onChange={e => setForm(p => ({ ...p, nazwa: e.target.value }))} placeholder="np. Kotlet schabowy" style={inp} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Kategoria *</label>
                    <select value={form.kategoria} onChange={e => setForm(p => ({ ...p, kategoria: e.target.value }))} style={inp}>
                      {WSZYSTKIE_KAT.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Cena (zł) *</label>
                    <input type="number" min="0" step="0.01" value={form.cena} onChange={e => setForm(p => ({ ...p, cena: e.target.value }))} placeholder="0.00" style={inp} required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Kalorie (kcal)</label>
                    <input type="number" min="0" value={form.kcal} onChange={e => setForm(p => ({ ...p, kcal: e.target.value }))} placeholder="0" style={inp} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.dostepne} onChange={e => setForm(p => ({ ...p, dostepne: e.target.checked }))} />
                      <span style={{ fontWeight: 500 }}>Dostępne w menu</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Opis / Składniki</label>
                  <textarea value={form.opis} onChange={e => setForm(p => ({ ...p, opis: e.target.value }))} placeholder="np. z ziemniakami i surówką..." rows={2} style={{ ...inp, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }}>Alergeny</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ALERGEN_OPCJE.map(a => {
                      const active = form.alergeny.includes(a)
                      return (
                        <button type="button" key={a} onClick={() => toggleAlergen(a)}
                          style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${active ? ALERGEN_COLOR[a] || '#2563EB' : '#E5E7EB'}`, background: active ? `${ALERGEN_COLOR[a] || '#2563EB'}22` : '#fff', color: active ? ALERGEN_COLOR[a] || '#2563EB' : '#6B7280', fontSize: 11, cursor: 'pointer', fontWeight: active ? 600 : 400 }}>
                          {active ? '✓ ' : ''}{a}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: '#fff' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#fff' }}>Anuluj</button>
                <button type="submit" style={{ padding: '8px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {editId ? 'Zapisz zmiany' : 'Dodaj do menu'}
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
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>Usuń danie?</h3>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>
              „{menu.find(d => d.id === confirmDelete)?.nazwa}" zostanie usunięte z menu.
            </p>
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
