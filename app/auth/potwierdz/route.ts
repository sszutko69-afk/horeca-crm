import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Obsługa linku z maila (aktywacja konta, reset hasła). Szablony maili w Supabase powinny wskazywać na:
//   {{ .SiteURL }}/auth/potwierdz?token_hash={{ .TokenHash }}&type=signup&next=/dashboard
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/dashboard'
  if (!next.startsWith('/') || next.startsWith('//')) next = '/dashboard' // tylko ścieżki wewnętrzne (open redirect)

  const supabase = await createServerSupabaseClient()
  let ok = false
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    ok = !error
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  }
  if (!ok) return NextResponse.redirect(`${origin}/login?blad=link`)
  if (type === 'recovery' || searchParams.get('type') === 'recovery') return NextResponse.redirect(`${origin}/nowe-haslo`)
  const sep = next.includes('?') ? '&' : '?'
  return NextResponse.redirect(`${origin}${next}${type === 'signup' || type === 'email' || code ? sep + 'witaj=1' : ''}`)
}
