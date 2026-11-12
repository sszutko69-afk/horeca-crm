'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const REGULAMIN_WERSJA = '2026-11'

export default function RejestracjaPage() {
  const supabase = createClient()
  const [firma, setFirma] = useState('')
  const [imie, setImie] = useState('')
  const [email, setEmail] = useState('')
  const [haslo, setHaslo] = useState('')
  const [haslo2, setHaslo2] = useState('')
  const [regulamin, setRegulamin] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [wyslano, setWyslano] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (haslo.length < 10) return setError('Hasło musi mieć co najmniej 10 znaków.')
    if (haslo !== haslo2) return setError('Hasła nie są takie same.')
    if (!regulamin) return setError('Zaakceptuj regulamin i politykę prywatności, aby założyć konto.')
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: haslo,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/potwierdz?next=/dashboard`,
        data: {
          nazwa_firmy: firma.trim(),
          imie_nazwisko: imie.trim(),
          zgoda_marketing: marketing,
          regulamin_wersja: REGULAMIN_WERSJA,
        },
      },
    })
    setLoading(false)
    if (error) {
      setError(error.message.toLowerCase().includes('password')
        ? 'Hasło jest zbyt słabe. Użyj dłuższego hasła z literami i cyframi.'
        : 'Nie udało się założyć konta. Sprawdź dane i spróbuj ponownie.')
      return
    }
    // Supabase nie ujawnia, czy adres już istnieje (ochrona przed zgadywaniem kont): komunikat jest zawsze ten sam.
    setWyslano(true)
  }

  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const lab = 'block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-md shadow-sm">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Załóż konto w Skrojo</h1>
          <p className="text-sm text-gray-500 mt-1">Pełna wersja systemu przez 7 dni, bez karty płatniczej</p>
        </div>

        {wyslano ? (
          <div className="text-center py-2">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p className="font-medium text-gray-900">Sprawdź skrzynkę e-mail</p>
            <p className="text-sm text-gray-500 mt-2">
              Wysłaliśmy link aktywacyjny na adres <b>{email}</b>. Kliknij go, aby aktywować konto i zalogować się do systemu.
              Jeśli wiadomości nie widać, sprawdź folder SPAM.
            </p>
            <Link href="/login" className="inline-block mt-5 text-sm text-blue-600 hover:underline">Przejdź do logowania</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={lab}>Nazwa firmy</label>
              <input className={inp} value={firma} onChange={e => setFirma(e.target.value)} required maxLength={120} autoComplete="organization" />
            </div>
            <div>
              <label className={lab}>Imię i nazwisko</label>
              <input className={inp} value={imie} onChange={e => setImie(e.target.value)} required maxLength={120} autoComplete="name" />
            </div>
            <div>
              <label className={lab}>Adres e-mail (to będzie Twój login)</label>
              <input type="email" className={inp} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="jan@firma.pl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lab}>Hasło</label>
                <input type="password" className={inp} value={haslo} onChange={e => setHaslo(e.target.value)} required minLength={10} autoComplete="new-password" />
              </div>
              <div>
                <label className={lab}>Powtórz hasło</label>
                <input type="password" className={inp} value={haslo2} onChange={e => setHaslo2(e.target.value)} required minLength={10} autoComplete="new-password" />
              </div>
            </div>
            <p className="text-xs text-gray-400 -mt-2">Minimum 10 znaków.</p>

            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={regulamin} onChange={e => setRegulamin(e.target.checked)} className="mt-0.5" required />
              <span>Akceptuję <Link href="/regulamin" target="_blank" className="text-blue-600 underline">regulamin</Link> oraz zapoznałem(-am) się z <Link href="/polityka-prywatnosci" target="_blank" className="text-blue-600 underline">polityką prywatności</Link>.</span>
            </label>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} className="mt-0.5" />
              <span>Chcę otrzymywać informacje o nowościach i ofertach Skrojo na podany adres e-mail (opcjonalnie, zgodę można cofnąć w każdej chwili).</span>
            </label>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Zakładanie konta…' : 'Zarejestruj się'}
            </button>
            <p className="text-center text-sm text-gray-500">Masz już konto? <Link href="/login" className="text-blue-600 hover:underline">Zaloguj się</Link></p>
          </form>
        )}
      </div>
    </div>
  )
}
