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
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: data.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const d = await r.json()
    if (d.access_token) {
      await supabase.from('user_google_tokens').update({
        access_token: d.access_token,
        expires_at: new Date(Date.now() + d.expires_in * 1000).toISOString(),
      }).eq('user_id', userId)
      return d.access_token
    }
    return null
  }
  return data.access_token
}

const BASE = 'https://tasks.googleapis.com/tasks/v1'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'Brak userId' }, { status: 400 })
  const token = await getToken(userId)
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 401 })

  // Pobierz listę tasklist
  const listsRes = await fetch(`${BASE}/users/@me/lists`, { headers: { Authorization: `Bearer ${token}` } })
  const listsData = await listsRes.json()
  const lists = listsData.items ?? []
  const defaultList = lists[0]?.id ?? '@default'

  // Pobierz zadania z domyślnej listy
  const tasksRes = await fetch(
    `${BASE}/lists/${defaultList}/tasks?showCompleted=true&showHidden=false&maxResults=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const tasksData = await tasksRes.json()
  return NextResponse.json({ tasks: tasksData.items ?? [], listId: defaultList, lists })
}

export async function POST(req: NextRequest) {
  const { userId, task, listId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Brak userId' }, { status: 400 })
  const token = await getToken(userId)
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 401 })

  const list = listId ?? '@default'
  const res = await fetch(`${BASE}/lists/${list}/tasks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  })
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data.error?.message }, { status: res.status })
  return NextResponse.json({ task: data })
}

export async function PATCH(req: NextRequest) {
  // Oznacz jako ukończone lub przywróć
  const { userId, taskId, listId, completed, title, due } = await req.json()
  if (!userId || !taskId) return NextResponse.json({ error: 'Brak parametrów' }, { status: 400 })
  const token = await getToken(userId)
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 401 })

  const list = listId ?? '@default'
  const update: any = {}
  if (completed !== undefined) update.status = completed ? 'completed' : 'needsAction'
  if (title !== undefined) update.title = title
  if (due !== undefined) update.due = due

  const res = await fetch(`${BASE}/lists/${list}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
  const data = await res.json()
  return NextResponse.json({ task: data })
}

export async function DELETE(req: NextRequest) {
  const { userId, taskId, listId } = await req.json()
  if (!userId || !taskId) return NextResponse.json({ error: 'Brak parametrów' }, { status: 400 })
  const token = await getToken(userId)
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 401 })

  const list = listId ?? '@default'
  await fetch(`${BASE}/lists/${list}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return NextResponse.json({ ok: true })
}
