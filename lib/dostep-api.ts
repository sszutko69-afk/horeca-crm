import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { modulyFirmy, type FirmaPlan } from '@/lib/plany'

// Strażnik tras API modułów płatnych: proxy blokuje strony modułów, ale nie trasy /api, więc dostęp do modułu
// (wybór branży, plan) sprawdzamy także tutaj. Zwraca klienta z sesją użytkownika (RLS = tylko dane własnej firmy).
export async function wymagajModulu(modul: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { blad: NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 }) } as const
  const { data: firma } = await supabase.from('firmy')
    .select('id,nazwa,demo,status,trial_do,stripe_status,subskrypcja_do,branza,moduly,onboarding_zakonczony').maybeSingle()
  if (!firma || !modulyFirmy(firma as FirmaPlan).includes(modul)) {
    return { blad: NextResponse.json({ error: `Moduł „${modul}” nie jest dostępny w Twoim planie.` }, { status: 403 }) } as const
  }
  return { supabase, user, firma: firma as FirmaPlan } as const
}
