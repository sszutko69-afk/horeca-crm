'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

// Logowanie / rejestracja przez Google (Supabase Auth, OAuth z PKCE). Wymaga włączonego dostawcy Google w Supabase.
// Konto utworzone przez Google dostaje firmę i 7-dniowy okres próbny (trigger handle_new_user), a wybór branży następuje w /start.
export default function GoogleButton({ etykieta, wylaczony, onBlad }: { etykieta: string; wylaczony?: boolean; onBlad?: (m: string) => void }) {
  const [busy, setBusy] = useState(false)

  async function zaloguj() {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/potwierdz?next=/dashboard` },
    })
    if (error) {
      setBusy(false)
      onBlad?.(/provider|not enabled|unsupported/i.test(error.message)
        ? 'Logowanie przez Google nie jest jeszcze włączone. Użyj adresu e-mail i hasła.'
        : 'Nie udało się rozpocząć logowania przez Google. Spróbuj ponownie.')
    }
  }

  return (
    <button type="button" onClick={zaloguj} disabled={busy || wylaczony}
      style={{ background: '#FFFFFF', color: '#1F2937', border: '1px solid #D1D5DB' }}
      className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed">
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
        <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z"/>
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
      </svg>
      {busy ? 'Łączenie z Google…' : etykieta}
    </button>
  )
}
