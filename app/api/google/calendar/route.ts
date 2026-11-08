import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getToken(userId: string): Promise<string | null> {
  const { data } = await supabase.from('user_google_tokens')
    .select('access_token, expires_at, refresh_token').eq('user_id', userId).maybeSingle()
  if (!data) return null
  if (new Date(data.expires_at) < new Date()) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: data.refresh_token, grant_type: 'refresh_token' }),
    })
    const d = await r.json()
    if (d.access_token) {
      await supabase.from('user_google_tokens').update({ access_token: d.access_token, expires_at: new Date(Date.now() + d.expires_in * 1000).toISOString() }).eq('user_id', userId)
      return d.access_token
    }
    return null
  }
  return data.access_token
}

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'Brak userId' }, { status: 400 })
  const token = await getToken(userId)
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 401 })
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${new Date().toISOString()}&maxResults=20&orderBy=startTime&singleEvents=true`, { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data.error?.message }, { status: res.status })
  return NextResponse.json({ events: data.items ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId, event } = await req.json()
  const token = await getToken(userId)
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 401 })
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(event),
  })
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data.error?.message }, { status: res.status })
  return NextResponse.json({ event: data })
}

export async function DELETE(req: NextRequest) {
  const { userId, eventId } = await req.json()
  const token = await getToken(userId)
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 401 })
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  return NextResponse.json({ ok: true })
}
