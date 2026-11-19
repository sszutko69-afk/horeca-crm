import { createAdminClient } from '@/lib/supabase-admin'

export type KonfigGps = { flespi_token: string | null; flespi_channel: string | null; imei: string | null; pojazd_nazwa: string | null }

// Konfiguracja trackera GPS firmy (token Flespi jest sekretem: tabela dostępna tylko przez service role, po sprawdzeniu dostępu do modułu).
export async function pobierzKonfiguracjeGps(firmaId: string): Promise<KonfigGps | null> {
  const { data } = await createAdminClient().from('gps_konfiguracja')
    .select('flespi_token,flespi_channel,imei,pojazd_nazwa').eq('firma_id', firmaId).maybeSingle()
  return (data as KonfigGps | null) ?? null
}

export const gpsGotowy = (k: KonfigGps | null): k is KonfigGps & { flespi_token: string; flespi_channel: string } =>
  !!k?.flespi_token && !!k?.flespi_channel
