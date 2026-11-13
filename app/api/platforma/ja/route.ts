import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { czyWlasciciel } from '@/lib/wlasciciel'

// Czy zalogowany użytkownik jest właścicielem platformy (steruje widocznością pozycji w menu).
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return NextResponse.json({ owner: czyWlasciciel(user) })
}
