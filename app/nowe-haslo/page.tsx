'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function NoweHaslo() {
  const supabase = createClient()
  const [h1, setH1] = useState('')
  const [h2, setH2] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (h1.length < 10) return setErr('Hasło musi mieć co najmniej 10 znaków.')
    if (h1 !== h2) return setErr('Hasła nie są takie same.')
    const { error } = await supabase.auth.updateUser({ password: h1 })
    if (error) return setErr('Nie udało się zmienić hasła. Link mógł wygasnąć: poproś o nowy.')
    setOk(true)
    setTimeout(() => { window.location.href = '/dashboard' }, 1200)
  }
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 text-center">Ustaw nowe hasło</h1>
        {ok ? <p className="text-sm text-green-700 mt-4 text-center">Hasło zmienione. Przekierowanie…</p> : (
          <form onSubmit={save} className="space-y-4 mt-5">
            <input type="password" required minLength={10} value={h1} onChange={e => setH1(e.target.value)} placeholder="Nowe hasło (min. 10 znaków)" autoComplete="new-password" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input type="password" required minLength={10} value={h2} onChange={e => setH2(e.target.value)} placeholder="Powtórz hasło" autoComplete="new-password" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium">Zapisz hasło</button>
          </form>
        )}
      </div>
    </div>
  )
}
