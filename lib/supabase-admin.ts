import { createClient } from '@supabase/supabase-js'

// Klient z kluczem service role: omija RLS. Tylko po stronie serwera (route handlers, webhooki).
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Brak SUPABASE_SERVICE_ROLE_KEY na serwerze')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
