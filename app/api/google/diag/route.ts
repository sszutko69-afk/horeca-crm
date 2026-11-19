import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { czyWlasciciel } from '@/lib/wlasciciel'

// Diagnostyka konfiguracji Google OAuth: tylko dla właściciela platformy, bez ujawniania fragmentów sekretów.
export async function GET(req: Request) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!czyWlasciciel(user)) return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  return NextResponse.json({
    client_id_set: !!process.env.GOOGLE_CLIENT_ID,
    client_secret_set: !!process.env.GOOGLE_CLIENT_SECRET,
    app_url: appUrl,
    redirect_uri: `${appUrl}/api/google/auth?action=callback`,
  })
}
