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

function getHeader(h: {name:string;value:string}[], name: string) {
  return h.find(x => x.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function fmtDate(ts: string): string {
  if (!ts) return ''
  const d = new Date(parseInt(ts)), now = new Date()
  const diff = Math.floor((now.getTime()-d.getTime())/86400000)
  if (diff===0) return d.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})
  if (diff===1) return 'wczoraj'
  if (diff<7) return d.toLocaleDateString('pl-PL',{weekday:'short'})
  if (d.getFullYear()===now.getFullYear()) return d.toLocaleDateString('pl-PL',{day:'numeric',month:'short'})
  return d.toLocaleDateString('pl-PL',{day:'numeric',month:'short',year:'numeric'})
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const userId = sp.get('userId')
  const action = sp.get('action') ?? 'list'
  if (!userId) return NextResponse.json({ error: 'Brak userId' }, { status: 400 })
  const token = await getToken(userId)
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 401 })

  if (action === 'list') {
    const q = sp.get('q') ?? 'in:inbox'
    const max = sp.get('max') ?? '50'
    const pageToken = sp.get('pageToken') ?? ''
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent(q)}${pageToken?'&pageToken='+pageToken:''}`
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json()
    if (!r.ok) return NextResponse.json({ error: d.error?.message }, { status: r.status })
    return NextResponse.json({ messages: d.messages??[], total: d.resultSizeEstimate, nextPageToken: d.nextPageToken })
  }

  if (action === 'metadata') {
    const ids = (sp.get('ids')?? '').split(',').filter(Boolean).slice(0, 50)
    if (!ids.length) return NextResponse.json({ messages: [] })
    const BATCH = 10
    const results: any[] = []
    for (let i=0; i<ids.length; i+=BATCH) {
      const batch = ids.slice(i, i+BATCH)
      const fetched = await Promise.all(batch.map(id =>
        fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=To`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r=>r.json()).catch(()=>null)
      ))
      results.push(...fetched.filter(Boolean))
    }
    const messages = results.map(m => ({
      id: m.id, threadId: m.threadId, snippet: m.snippet,
      labelIds: m.labelIds??[], unread: m.labelIds?.includes('UNREAD')??false,
      internalDate: m.internalDate, date: fmtDate(m.internalDate??''),
      from: getHeader(m.payload?.headers??[],'From'),
      to: getHeader(m.payload?.headers??[],'To'),
      subject: getHeader(m.payload?.headers??[],'Subject'),
    }))
    return NextResponse.json({ messages })
  }

  if (action === 'message') {
    const id = sp.get('id')
    if (!id) return NextResponse.json({ error: 'Brak id' }, { status: 400 })
    const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return NextResponse.json(await r.json())
  }

  if (action === 'attachment') {
    const msgId = sp.get('msgId'), attId = sp.get('attId')
    if (!msgId || !attId) return NextResponse.json({ error: 'Brak parametrów' }, { status: 400 })
    const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${attId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return NextResponse.json(await r.json())
  }

  if (action === 'labels') {
    const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const d = await r.json()
    return NextResponse.json({ labels: d.labels??[] })
  }

  return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, action } = body
  if (!userId) return NextResponse.json({ error: 'Brak userId' }, { status: 400 })
  const token = await getToken(userId)
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 401 })

  // Wyślij mail (z lub bez załączników)
  if (!action || action === 'send') {
    const { to, cc, bcc, subject, bodyText, bodyHtml, attachments, inReplyTo, references } = body

    const boundary = `boundary_${Date.now()}`
    const hasAttachments = attachments?.length > 0
    const isHtml = !!bodyHtml

    let emailLines = [
      `To: ${to}`,
      cc ? `Cc: ${cc}` : null,
      bcc ? `Bcc: ${bcc}` : null,
      `Subject: =?UTF-8?B?${Buffer.from(subject||'').toString('base64')}?=`,
      'MIME-Version: 1.0',
      inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
      references ? `References: ${references}` : null,
    ].filter(Boolean) as string[]

    if (hasAttachments) {
      emailLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
      emailLines.push('')
      emailLines.push(`--${boundary}`)
    }

    if (isHtml) {
      emailLines.push('Content-Type: text/html; charset=UTF-8')
      emailLines.push('Content-Transfer-Encoding: base64')
      emailLines.push('')
      emailLines.push(Buffer.from(bodyHtml).toString('base64'))
    } else {
      emailLines.push('Content-Type: text/plain; charset=UTF-8')
      emailLines.push('Content-Transfer-Encoding: base64')
      emailLines.push('')
      emailLines.push(Buffer.from(bodyText||'').toString('base64'))
    }

    // Załączniki
    if (hasAttachments) {
      for (const att of attachments) {
        emailLines.push('')
        emailLines.push(`--${boundary}`)
        emailLines.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`)
        emailLines.push('Content-Transfer-Encoding: base64')
        emailLines.push(`Content-Disposition: attachment; filename="${att.filename}"`)
        emailLines.push('')
        emailLines.push(att.data) // już base64
      }
      emailLines.push('')
      emailLines.push(`--${boundary}--`)
    }

    const raw = Buffer.from(emailLines.join('\r\n')).toString('base64')
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')

    const threadId = body.threadId
    const sendBody: any = { raw }
    if (threadId) sendBody.threadId = threadId

    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(sendBody),
    })
    const d = await r.json()
    if (!r.ok) return NextResponse.json({ error: d.error?.message }, { status: r.status })
    return NextResponse.json({ ok: true, id: d.id })
  }

  return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 })
}

// Operacje na mailach: oznacz przeczytane, przenieś do kosza, dodaj label
export async function PATCH(req: NextRequest) {
  const { userId, messageIds, action, labelIds, removeLabelIds } = await req.json()
  if (!userId || !messageIds?.length) return NextResponse.json({ error: 'Brak parametrów' }, { status: 400 })
  const token = await getToken(userId)
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 401 })

  const results = await Promise.all(messageIds.map(async (id: string) => {
    let add: string[] = [], remove: string[] = []

    if (action === 'markRead')   remove = ['UNREAD']
    if (action === 'markUnread') add = ['UNREAD']
    if (action === 'star')       add = ['STARRED']
    if (action === 'unstar')     remove = ['STARRED']
    if (action === 'important')  add = ['IMPORTANT']
    if (action === 'trash')      add = ['TRASH'], remove = ['INBOX']
    if (action === 'inbox')      add = ['INBOX'], remove = ['TRASH', 'SPAM']
    if (action === 'spam')       add = ['SPAM'], remove = ['INBOX']
    if (action === 'label')      add = labelIds??[], remove = removeLabelIds??[]

    const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
    })
    return r.ok
  }))

  return NextResponse.json({ ok: true, updated: results.filter(Boolean).length })
}

export async function DELETE(req: NextRequest) {
  const { userId, messageIds } = await req.json()
  if (!userId || !messageIds?.length) return NextResponse.json({ error: 'Brak parametrów' }, { status: 400 })
  const token = await getToken(userId)
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 401 })

  // Trwałe usunięcie
  await Promise.all(messageIds.map((id: string) =>
    fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  ))
  return NextResponse.json({ ok: true, deleted: messageIds.length })
}
