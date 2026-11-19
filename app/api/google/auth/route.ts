import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const COOKIE_STATE = 'google_oauth_state'

// Krok 1: Redirect do Google OAuth
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const action = searchParams.get('action')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/google?google_error=' + encodeURIComponent('Integracja z Google nie jest jeszcze skonfigurowana (brak danych aplikacji Google).'), req.url))
  }

  // użytkownik wyłącznie z sesji
  const sesja = await createServerSupabaseClient()
  const { data: { user: uzytkownik } } = await sesja.auth.getUser()
  if (!uzytkownik) return NextResponse.redirect(new URL('/login', req.url))

  // ── Callback z Google ────────────────────────────────────────────────────
  if (action === 'callback') {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oczekiwany = req.cookies.get(COOKIE_STATE)?.value
    if (!oczekiwany || !state || state !== oczekiwany) return NextResponse.redirect(new URL('/google?google_error=nieprawidlowy+stan+logowania', req.url))
    if (!code) return NextResponse.redirect(new URL('/google?google_error=brak+kodu', req.url))

    try {
      // Wymień kod na tokeny
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `${appUrl}/api/google/auth?action=callback`,
          grant_type: 'authorization_code',
        }),
      })

      const tokens = await tokenRes.json()
      if (!tokens.access_token) {
        const msg = tokens.error_description ?? tokens.error ?? 'brak access_token'
        return NextResponse.redirect(new URL(`/google?google_error=${encodeURIComponent(msg)}`, req.url))
      }

      // Pobierz email konta Google
      let googleEmail: string | null = null
      try {
        const ui = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
        if (ui.ok) googleEmail = (await ui.json()).email ?? null
      } catch { /* nieistotne */ }

      const saveUserId = uzytkownik.id

      // Usuń stary token (jeśli istnieje) i wstaw nowy — unika konfliktów upsert
      const supabase = serviceClient()
      await supabase.from('user_google_tokens').delete().eq('user_id', saveUserId)
      // service role nie ma auth.uid(), więc firma_id podajemy jawnie (z profilu użytkownika)
      const { data: pf } = await supabase.from('profiles').select('firma_id').eq('id', saveUserId).single()
      const { error } = await supabase.from('user_google_tokens').insert({
        user_id: saveUserId,
        firma_id: pf?.firma_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
        scope: tokens.scope ?? null,
        google_email: googleEmail,
      })

      if (error) {
        return NextResponse.redirect(new URL(`/google?google_error=${encodeURIComponent(error.message)}`, req.url))
      }

      const ok = new URL('/google?google_connected=1', req.url)
      if (googleEmail) ok.searchParams.set('google_email', googleEmail)
      const odp = NextResponse.redirect(ok)
      odp.cookies.delete(COOKIE_STATE)
      return odp

    } catch (err: unknown) {
      const msg = (err as Error).message ?? 'nieznany błąd'
      return NextResponse.redirect(new URL(`/google?google_error=${encodeURIComponent(msg)}`, req.url))
    }
  }

  // ── Krok 1: Przekieruj do Google (state = jednorazowy nonce w ciasteczku) ──
  const nonce = crypto.randomUUID()
  const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleUrl.searchParams.set('client_id', clientId)
  googleUrl.searchParams.set('redirect_uri', `${appUrl}/api/google/auth?action=callback`)
  googleUrl.searchParams.set('response_type', 'code')
  googleUrl.searchParams.set('scope', [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/tasks',
  ].join(' '))
  googleUrl.searchParams.set('access_type', 'offline')
  googleUrl.searchParams.set('prompt', 'consent')
  googleUrl.searchParams.set('state', nonce)
  const odp = NextResponse.redirect(googleUrl)
  odp.cookies.set(COOKIE_STATE, nonce, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' })
  return odp
}

// Odłącz konto Google
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('action') !== 'disconnect') return NextResponse.json({ ok: false }, { status: 400 })

  // odłączać można wyłącznie własne konto Google (użytkownik z sesji, nie z treści żądania)
  const sesja = await createServerSupabaseClient()
  const { data: { user } } = await sesja.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = serviceClient()
  await supabase.from('user_google_tokens').delete().eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
