import type { SupabaseClient } from '@supabase/supabase-js'
import { rozbierzUrlPliku } from '@/lib/pliki'

// Dla kodu serwerowego (odczyt treści pliku przez AI itp.): zamienia adres pliku z magazynu na podpisany link (sesja użytkownika, RLS).
// Adresy zewnętrzne zwraca bez zmian.
export async function podpiszDlaSerwera(supabase: SupabaseClient, url: string, ttl = 300): Promise<string> {
  const r = rozbierzUrlPliku(url)
  if (!r) return url
  const { data, error } = await supabase.storage.from(r.bucket).createSignedUrl(r.path, ttl)
  if (error || !data?.signedUrl) throw new Error('Brak dostępu do pliku')
  return data.signedUrl
}
