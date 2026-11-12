import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Pobierz userId z bazy — najpierw z auth.users (admin), fallback z profiles
async function resolveUserId(stateParam: string | null): Promise<string | null> {
  const supabase = serviceClient()
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  // 1. state z OAuth — jeśli to prawidłowy UUID, użyj go
  if (stateParam && UUID_RE.test(stateParam)) return stateParam

  // 2. admin.listUsers — najnowszy użytkownik
  try {
    const { data } = await supabase.auth.admin.listUsers({ perPage: 1 })
    if (data?.users?.[0]?.id) return data.users[0].id
  } catch { /* admin API niedostępne */ }

  // 3. profiles table
  try {
    const { data } = await supabase.from('profiles').select('id').limit(1).maybeSingle()
    if (data?.id) return data.id
  } catch { /* brak tabeli profiles */ }

  return null
}

// Krok 1: Redirect do Google OAuth
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // ── Callback z Google ────────────────────────────────────────────────────
  if (action === 'callback') {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    if (!code) return NextResponse.redirect(new URL('/google?google_error=brak+kodu', req.url))

    try {
      // Wymień kod na tokeny
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google/auth?action=callback`,
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

      // Ustal Supabase userId
      const saveUserId = await resolveUserId(state)
      if (!saveUserId) {
        return NextResponse.redirect(new URL('/google?google_error=nie+znaleziono+uzytkownika', req.url))
      }

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
      return NextResponse.redirect(ok)

    } catch (err: unknown) {
      const msg = (err as Error).message ?? 'nieznany błąd'
      return NextResponse.redirect(new URL(`/google?google_error=${encodeURIComponent(msg)}`, req.url))
    }
  }

  // ── Krok 1: Przekieruj do Google ────────────────────────────────────────
  const userId = searchParams.get('userId') ?? ''

  const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  googleUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/google/auth?action=callback`)
  googleUrl.searchParams.set('response_type', 'code')
  googleUrl.searchParams.set('scope', [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/tasks',
  ].join(' '))
  googleUrl.searchParams.set('access_type', 'offline')
  googleUrl.searchParams.set('prompt', 'consent')
  googleUrl.searchParams.set('state', userId)

  return NextResponse.redirect(googleUrl)
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
