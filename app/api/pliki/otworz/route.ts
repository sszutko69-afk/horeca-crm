import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rozbierzUrlPliku } from '@/lib/pliki'

// Otwarcie pliku z prywatnego magazynu: wymaga zalogowania; dostęp do pliku weryfikuje baza (RLS: plik musi należeć do firmy użytkownika).
// Zwraca przekierowanie do podpisanego linku ważnego 2 minuty.
export async function GET(req: NextRequest) {
  const sesja = await createServerSupabaseClient()
  const { data: { user } } = await sesja.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const u = req.nextUrl.searchParams.get('u') ?? ''
  const plik = rozbierzUrlPliku(u)
  if (!plik) return NextResponse.json({ error: 'Nieprawidłowy adres pliku.' }, { status: 400 })

  const pobierz = req.nextUrl.searchParams.get('pobierz') === '1'
  const nazwa = plik.path.split('/').pop()?.replace(/^\d+_[a-z0-9]+\./i, 'plik.') ?? 'plik'
  const { data, error } = await sesja.storage.from(plik.bucket).createSignedUrl(plik.path, 120, pobierz ? { download: nazwa } : undefined)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Nie znaleziono pliku lub brak dostępu.' }, { status: 404 })
  const odp = NextResponse.redirect(data.signedUrl)
  odp.headers.set('Cache-Control', 'private, no-store')
  return odp
}
