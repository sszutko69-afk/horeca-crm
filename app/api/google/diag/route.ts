import { NextResponse } from 'next/server'

// Diagnostyczny endpoint — sprawdza konfigurację Google OAuth bez ujawniania pełnych wartości
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return NextResponse.json({
    client_id_set: !!clientId,
    client_id_prefix: clientId.substring(0, 20),
    client_secret_set: !!clientSecret,
    client_secret_length: clientSecret.length,
    client_secret_prefix: clientSecret.substring(0, 6),
    client_secret_suffix: clientSecret.substring(clientSecret.length - 4),
    app_url: appUrl,
    redirect_uri: `${appUrl}/api/google/auth?action=callback`,
  })
}
