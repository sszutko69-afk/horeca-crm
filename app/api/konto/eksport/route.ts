import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { TABELE_FIRMY } from '@/lib/tabele-firmy'

// Eksport wszystkich danych firmy do JSON (RODO: prawo do przenoszenia danych). Dostęp tylko dla administratora firmy.
// Zapytania idą przez klienta użytkownika, więc RLS gwarantuje, że widzi wyłącznie dane własnej firmy.
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 })
  const { data: profil } = await supabase.from('profiles').select('rola').eq('id', user.id).single()
  if (profil?.rola !== 'admin') return NextResponse.json({ error: 'Tylko administrator firmy.' }, { status: 403 })

  const wynik: Record<string, unknown> = { wygenerowano: new Date().toISOString() }
  const { data: firma } = await supabase.from('firmy').select('nazwa,nip,status,created_at').single()
  wynik.firma = firma
  const { data: konta } = await supabase.from('profiles').select('imie_nazwisko,login,telefon,rola,aktywny,created_at')
  wynik.uzytkownicy = konta
  for (const t of TABELE_FIRMY) {
    const { data } = await supabase.from(t).select('*').limit(50000)
    wynik[t] = data ?? []
  }
  return new NextResponse(JSON.stringify(wynik, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="skrojo-eksport-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
