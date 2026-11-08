'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Profile = {
  id: string
  imie_nazwisko: string
  login: string
  telefon: string | null
  rola: string
  aktywny: boolean
  moduly: string[] | null
  created_at: string
  twofa_enabled: boolean | null
}

const WSZYSTKIE_MODULY = [
  'Dashboard','Klienci','Zakupy','Sprzedaż','Raporty',
  'AI — Finanse','Mapa klientów','Cysterna & GPS','Ewidencja EDD','EMCS PL 2',
  'Inwestycje','inFakt','Import danych','Archiwizacja','Przetargi','Użytkownicy',
]

const roleLabel: Record<string, string> = {
  admin: 'Administrator',
  pracownik_admin: 'Prac. administracyjny',
  pracownik_inwestycji: 'Prac. inwestycji',
  kierowca: 'Kierowca',
}
const roleColor: Record<string, string> = {
  admin: 'bg-red-50 text-red-700',
  pracownik_admin: 'bg-blue-50 text-blue-700',
  pracownik_inwestycji: 'bg-green-50 text-green-700',
  kierowca: 'bg-yellow-50 text-yellow-700',
}

// Domyślne moduły dla roli
const roleDomyslne: Record<string, string[]> = {
  admin: WSZYSTKIE_MODULY,
  pracownik_admin: ['Dashboard','Klienci','Zakupy','Sprzedaż','Raporty','AI — Finanse','Import danych','Przetargi'],
  pracownik_inwestycji: ['Dashboard','Inwestycje','Przetargi'],
  kierowca: ['Dashboard','Cysterna & GPS'],
}

const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
const labelCls = "text-xs font-medium text-gray-500 uppercase tracking-wide"

export default function UzytkownicyPage() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', imie_nazwisko: '', login: '', telefon: '', rola: 'pracownik_admin', haslo: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ imie_nazwisko: '', login: '', telefon: '', rola: 'pracownik_admin', aktywny: true, twofa_enabled: false })
  const [editModuly, setEditModuly] = useState<string[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteNazwa, setDeleteNazwa] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user?.id ?? null)
    const { data: myProfile } = await supabase.from('profiles').select('rola').eq('id', user?.id ?? '').single()
    setIsAdmin(myProfile?.rola === 'admin')
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    if (data) setProfiles(data)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Błąd tworzenia konta')
    } else {
      setSuccess('Konto utworzone!')
      setForm({ email: '', imie_nazwisko: '', login: '', telefon: '', rola: 'pracownik_admin', haslo: '' })
      setShowForm(false); fetchAll()
      setTimeout(() => setSuccess(''), 4000)
    }
    setSaving(false)
  }

  function openEdit(p: Profile) {
    setEditId(p.id)
    setEditForm({ imie_nazwisko: p.imie_nazwisko, login: p.login, telefon: p.telefon ?? '', rola: p.rola, aktywny: p.aktywny, twofa_enabled: p.twofa_enabled ?? false })
    // Użyj zapisanych modułów lub domyślnych dla roli
    setEditModuly(p.moduly ?? roleDomyslne[p.rola] ?? [])
  }

  // Gdy rola się zmienia — zaktualizuj moduły do domyślnych dla nowej roli
  function handleRolaChange(nowaRola: string) {
    setEditForm(f => ({ ...f, rola: nowaRola }))
    setEditModuly(roleDomyslne[nowaRola] ?? [])
  }

  function toggleModul(modul: string) {
    setEditModuly(prev =>
      prev.includes(modul) ? prev.filter(m => m !== modul) : [...prev, modul]
    )
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editId) return; setEditSaving(true)
    const { error } = await supabase.from('profiles').update({
      imie_nazwisko: editForm.imie_nazwisko.trim(),
      login: editForm.login.trim(),
      telefon: editForm.telefon.trim() || null,
      rola: editForm.rola,
      aktywny: editForm.aktywny,
      moduly: editModuly,
      twofa_enabled: editForm.twofa_enabled,
    }).eq('id', editId)
    if (error) {
      setError('Błąd: ' + error.message)
    } else {
      setSuccess('Zapisano uprawnienia!')
      setEditId(null); fetchAll()
      setTimeout(() => setSuccess(''), 3000)
    }
    setEditSaving(false)
  }

  async function toggleAktywny(p: Profile) {
    if (p.id === currentUser || !isAdmin) return
    await supabase.from('profiles').update({ aktywny: !p.aktywny }).eq('id', p.id)
    fetchAll()
  }

  async function handleDelete() {
    if (!deleteId) return
    setError('')
    const res = await fetch('/api/admin/delete-user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: deleteId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Błąd usuwania konta')
    } else {
      setSuccess('Konto usunięte.')
      setTimeout(() => setSuccess(''), 3000)
    }
    setDeleteId(null); fetchAll()
  }

  const detail = profiles.find(p => p.id === detailId)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Użytkownicy</h1>
          <p className="text-sm text-gray-500 mt-0.5">Role i uprawnienia · {profiles.length} kont</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(true)}
            className="text-sm bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700 transition-colors">
            + Nowe konto
          </button>
        )}
      </div>

      {success && <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mb-4">{success}</p>}
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-4">{error}</p>}

      {!isAdmin && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs text-yellow-800">Tylko administrator może tworzyć i edytować konta użytkowników.</p>
        </div>
      )}

      {/* Lista użytkowników */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Ładowanie...</p>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">Brak profili.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Użytkownik</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Rola</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Dostępne moduły</th>
                <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Status</th>
                <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide py-3 px-4">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => {
                const initials = p.imie_nazwisko.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                const isMe = p.id === currentUser
                const moduly = p.moduly ?? roleDomyslne[p.rola] ?? []
                return (
                  <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!p.aktywny ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center flex-shrink-0">{initials}</div>
                        <div>
                          <p className="font-medium text-gray-900">{p.imie_nazwisko}{isMe && <span className="ml-1 text-xs text-gray-400">(Ty)</span>}</p>
                          <p className="text-xs text-gray-400">{p.login}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[p.rola] ?? 'bg-gray-100 text-gray-600'}`}>
                        {roleLabel[p.rola] ?? p.rola}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {moduly.map(m => (
                          <span key={m} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{m}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => toggleAktywny(p)} disabled={isMe || !isAdmin}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed ${
                          p.aktywny ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {p.aktywny ? 'Aktywny' : 'Nieaktywny'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.twofa_enabled ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                        {p.twofa_enabled ? '🔐 2FA' : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setDetailId(p.id)}
                          className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-500">Info</button>
                        {isAdmin && (
                          <button onClick={() => openEdit(p)}
                            className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors text-gray-500">
                            Edytuj uprawnienia
                          </button>
                        )}
                        {isAdmin && !isMe && (
                          <button onClick={() => { setDeleteId(p.id); setDeleteNazwa(p.imie_nazwisko) }}
                            className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors text-gray-500">Usuń</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nowe konto */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md">
            <h2 className="text-base font-medium text-gray-900 mb-4">Nowe konto użytkownika</h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className={labelCls}>Imię i nazwisko</label>
                  <input value={form.imie_nazwisko} onChange={e => setForm(f => ({ ...f, imie_nazwisko: e.target.value }))} placeholder="Jan Kowalski" required className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jan@firma.pl" required className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Login</label>
                  <input value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))} placeholder="jan.kowalski" required className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Hasło tymczasowe</label>
                  <input type="password" value={form.haslo} onChange={e => setForm(f => ({ ...f, haslo: e.target.value }))} placeholder="min. 6 znaków" required minLength={6} className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Telefon 2FA</label>
                  <input value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} placeholder="+48 000 000 000" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className={labelCls}>Rola</label>
                  <select value={form.rola} onChange={e => setForm(f => ({ ...f, rola: e.target.value }))} className={inputCls}>
                    <option value="pracownik_admin">Pracownik administracyjny</option>
                    <option value="pracownik_inwestycji">Pracownik inwestycji</option>
                    <option value="kierowca">Kierowca</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
                  {saving ? 'Tworzenie...' : 'Utwórz konto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal edycji uprawnień */}
      {editId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-lg" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 className="text-base font-medium text-gray-900 mb-1">Edytuj uprawnienia</h2>
            <p className="text-xs text-gray-500 mb-4">{profiles.find(p => p.id === editId)?.imie_nazwisko}</p>
            <form onSubmit={handleEdit}>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className={labelCls}>Imię i nazwisko</label>
                  <input value={editForm.imie_nazwisko} onChange={e => setEditForm(f => ({ ...f, imie_nazwisko: e.target.value }))} required className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Login</label>
                  <input value={editForm.login} onChange={e => setEditForm(f => ({ ...f, login: e.target.value }))} required className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Telefon 2FA</label>
                  <input value={editForm.telefon} onChange={e => setEditForm(f => ({ ...f, telefon: e.target.value }))} placeholder="+48 000 000 000" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Rola</label>
                  <select value={editForm.rola}
                    onChange={e => handleRolaChange(e.target.value)}
                    disabled={editId === currentUser}
                    className={inputCls}>
                    <option value="pracownik_admin">Pracownik administracyjny</option>
                    <option value="pracownik_inwestycji">Pracownik inwestycji</option>
                    <option value="kierowca">Kierowca</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Status</label>
                  <select value={editForm.aktywny ? 'aktywny' : 'nieaktywny'}
                    onChange={e => setEditForm(f => ({ ...f, aktywny: e.target.value === 'aktywny' }))}
                    disabled={editId === currentUser}
                    className={inputCls}>
                    <option value="aktywny">Aktywny</option>
                    <option value="nieaktywny">Nieaktywny</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className={labelCls}>Weryfikacja dwuetapowa (2FA SMS)</label>
                  <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                    <button type="button"
                      onClick={() => setEditForm(f => ({ ...f, twofa_enabled: !f.twofa_enabled }))}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${editForm.twofa_enabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editForm.twofa_enabled ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                    </button>
                    <div>
                      <p className="text-sm text-gray-700">{editForm.twofa_enabled ? '2FA włączone' : '2FA wyłączone'}</p>
                      <p className="text-xs text-gray-400">
                        {editForm.twofa_enabled
                          ? 'Przy logowaniu wysyłany jest kod SMS na numer telefonu.'
                          : 'Logowanie tylko hasłem. Wymaga ustawionego numeru telefonu.'}
                      </p>
                    </div>
                  </div>
                  {editForm.twofa_enabled && !editForm.telefon && (
                    <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg">⚠ Uzupełnij numer telefonu — wymagany do wysyłki SMS.</p>
                  )}
                </div>
              </div>

              {/* Checkboxy modułów */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Dostęp do modułów</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditModuly(WSZYSTKIE_MODULY)}
                      className="text-xs text-blue-600 hover:text-blue-800">Zaznacz wszystkie</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={() => setEditModuly(['Dashboard'])}
                      className="text-xs text-gray-500 hover:text-gray-700">Wyczyść</button>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-2">
                  {WSZYSTKIE_MODULY.map(modul => (
                    <label key={modul} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={editModuly.includes(modul)}
                        onChange={() => toggleModul(modul)}
                        disabled={modul === 'Dashboard'}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className={`text-sm ${modul === 'Dashboard' ? 'text-gray-400' : 'text-gray-700 group-hover:text-gray-900'}`}>
                        {modul}
                        {modul === 'Dashboard' && <span className="text-xs text-gray-400 ml-1">(zawsze)</span>}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Zaznaczono: {editModuly.length} z {WSZYSTKIE_MODULY.length} modułów
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setEditId(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
                <button type="submit" disabled={editSaving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
                  {editSaving ? 'Zapisywanie...' : 'Zapisz uprawnienia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal szczegółów */}
      {detail && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-medium flex items-center justify-center">
                  {detail.imie_nazwisko.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{detail.imie_nazwisko}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[detail.rola] ?? 'bg-gray-100 text-gray-600'}`}>
                    {roleLabel[detail.rola] ?? detail.rola}
                  </span>
                </div>
              </div>
              <button onClick={() => setDetailId(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-500">Login</span><span className="font-mono text-xs">{detail.login}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Telefon 2FA</span><span>{detail.telefon || <span className="text-gray-300">nie ustawiony</span>}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={detail.aktywny ? 'text-green-600' : 'text-gray-400'}>{detail.aktywny ? 'Aktywny' : 'Nieaktywny'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Konto od</span><span>{new Date(detail.created_at).toLocaleDateString('pl-PL')}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">2FA SMS</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${detail.twofa_enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {detail.twofa_enabled ? '✓ Włączone' : 'Wyłączone'}
                </span>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3 mb-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Dostęp do modułów</p>
              <div className="flex flex-wrap gap-1">
                {(detail.moduly ?? roleDomyslne[detail.rola] ?? []).map(m => (
                  <span key={m} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{m}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDetailId(null)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Zamknij</button>
              {isAdmin && (
                <button onClick={() => { setDetailId(null); openEdit(detail) }}
                  className="flex-1 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                  Edytuj uprawnienia
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal usuwania */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
            <h2 className="text-base font-medium text-gray-900 mb-2">Usuń konto</h2>
            <p className="text-sm text-gray-500 mb-5">Czy na pewno usunąć konto <span className="font-medium text-gray-900">{deleteNazwa}</span>?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Tak, usuń</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
