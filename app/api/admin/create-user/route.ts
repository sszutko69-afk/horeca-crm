import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ROLE, ROLE_DOMYSLNE } from '@/lib/moduly'

export async function POST(request: NextRequest) {
  try {
    // Sprawdź czy zalogowany użytkownik to admin
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak autoryzacji — zaloguj się.' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('rola').eq('id', user.id).single()
    if (profile?.rola !== 'admin') {
      return NextResponse.json({ error: 'Tylko administrator może tworzyć konta.' }, { status: 403 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'Brak SUPABASE_SERVICE_ROLE_KEY na serwerze.' }, { status: 500 })
    }

    const { email, haslo, imie_nazwisko, login, telefon, rola } = await request.json()

    if (!email?.trim() || !haslo?.trim() || !imie_nazwisko?.trim() || !login?.trim()) {
      return NextResponse.json({ error: 'Wymagane pola: email, hasło, imię i nazwisko, login.' }, { status: 400 })
    }
    if (haslo.length < 6) {
      return NextResponse.json({ error: 'Hasło musi mieć co najmniej 6 znaków.' }, { status: 400 })
    }

    // Klient z service role — omija RLS
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Utwórz konto w Supabase Auth
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password: haslo,
      email_confirm: true,
    })

    if (authError || !newUser?.user) {
      const msg = authError?.message ?? 'Nieznany błąd Auth'
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        return NextResponse.json({ error: 'Konto z tym emailem już istnieje.' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Błąd tworzenia konta: ' + msg }, { status: 400 })
    }

    const userId = newUser.user.id
    const rolaVal = rola ?? 'kelner'
    if (!(ROLE as string[]).includes(rolaVal)) {
      await adminClient.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Nieprawidłowa rola.' }, { status: 400 })
    }

    // 2. Utwórz profil (service role — omija RLS)
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: userId,
      imie_nazwisko: imie_nazwisko.trim(),
      login: login.trim(),
      telefon: telefon?.trim() || null,
      rola: rolaVal,
      aktywny: true,
      moduly: ROLE_DOMYSLNE[rolaVal],
    })

    if (profileError) {
      // Cofnij — usuń konto auth żeby nie było sieroty
      await adminClient.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Błąd zapisu profilu: ' + profileError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user_id: userId })

  } catch (err: any) {
    return NextResponse.json({ error: 'Błąd serwera: ' + err.message }, { status: 500 })
  }
}
