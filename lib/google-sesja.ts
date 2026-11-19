import { createServerSupabaseClient } from '@/lib/supabase-server'

// Identyfikator zalogowanego użytkownika z sesji (cookie). Trasy Google nigdy nie ufają userId z treści żądania:
// inaczej każdy zalogowany użytkownik mógłby czytać cudzą pocztę i kalendarz.
export async function idUzytkownikaZSesji(): Promise<string | null> {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  return user?.id ?? null
}
