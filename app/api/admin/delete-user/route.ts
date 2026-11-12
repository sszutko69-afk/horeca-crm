import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('rola').eq('id', user.id).single()
    if (profile?.rola !== 'admin') {
      return NextResponse.json({ error: 'Tylko administrator może usuwać konta.' }, { status: 403 })
    }

    const { user_id } = await request.json()
    if (!user_id) return NextResponse.json({ error: 'Brak user_id.' }, { status: 400 })

    // Nie można usunąć samego siebie
    if (user_id === user.id) {
      return NextResponse.json({ error: 'Nie można usunąć własnego konta.' }, { status: 400 })
    }

    // Izolacja firm: klient użytkownika widzi (RLS) tylko profile własnej firmy, więc obce konto da tu brak wyniku
    const { data: cel } = await supabase.from('profiles').select('id').eq('id', user_id).maybeSingle()
    if (!cel) return NextResponse.json({ error: 'Nie znaleziono użytkownika w Twojej firmie.' }, { status: 404 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: 'Brak SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Usuń profil
    await adminClient.from('profiles').delete().eq('id', user_id)

    // Usuń z auth.users (service role)
    const { error } = await adminClient.auth.admin.deleteUser(user_id)
    if (error) return NextResponse.json({ error: 'Błąd usuwania konta: ' + error.message }, { status: 500 })

    return NextResponse.json({ ok: true })

  } catch (err: any) {
    return NextResponse.json({ error: 'Błąd serwera: ' + err.message }, { status: 500 })
  }
}
