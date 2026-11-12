'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function ResetHasla() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)
  async function send(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/potwierdz?type=recovery`,
    })
    setLoading(false)
    setOk(true) // zawsze ten sam komunikat (nie ujawniamy, które adresy mają konto)
  }
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 text-center">Reset hasła</h1>
        {ok ? (
          <p className="text-sm text-gray-600 mt-4 text-center">Jeśli konto z tym adresem istnieje, wysłaliśmy na niego link do ustawienia nowego hasła.</p>
        ) : (
          <form onSubmit={send} className="space-y-4 mt-5">
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Twój adres e-mail"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <button disabled={loading} className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60">
              {loading ? 'Wysyłanie…' : 'Wyślij link'}
            </button>
          </form>
        )}
        <p className="text-center text-sm mt-5"><Link href="/login" className="text-blue-600 hover:underline">Wróć do logowania</Link></p>
      </div>
    </div>
  )
}
