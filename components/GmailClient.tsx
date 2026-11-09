'use client'

import { useState, useRef, useCallback } from 'react'

type GmailMsg = {
  id: string; threadId: string; snippet?: string
  subject?: string; from?: string; to?: string; date?: string
  unread?: boolean; labelIds?: string[]
  payload?: {
    headers: {name:string;value:string}[]
    body?: {data?:string; size?:number}
    parts?: any[]
    mimeType?: string
  }
  internalDate?: string
}

type Attachment = {
  filename: string; mimeType: string; size: number; attachmentId: string; messageId: string
}

function getHeader(h:{name:string;value:string}[], name:string) {
  return h?.find(x=>x.name.toLowerCase()===name.toLowerCase())?.value??''
}

function decodeB64(s:string):string {
  try { return Buffer ? Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf-8')
    : decodeURIComponent(atob(s.replace(/-/g,'+').replace(/_/g,'/')).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''))
  } catch { return '' }
}

function extractParts(payload:any, results:{html?:string;plain?:string;attachments:Attachment[]} = {attachments:[]}) {
  if (!payload) return results
  const parts = payload.parts ?? []
  if (payload.mimeType==='text/html' && payload.body?.data) results.html = decodeB64(payload.body.data)
  if (payload.mimeType==='text/plain' && payload.body?.data) results.plain = decodeB64(payload.body.data)
  if (payload.filename && payload.body?.attachmentId) {
    results.attachments.push({ filename:payload.filename, mimeType:payload.mimeType, size:payload.body.size??0, attachmentId:payload.body.attachmentId, messageId:'' })
  }
  for (const p of parts) extractParts(p, results)
  return results
}

const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white"

type Props = { userId: string }

export default function GmailClient({ userId }: Props) {
  const [messages, setMessages] = useState<GmailMsg[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('in:inbox')
  const [nextPage, setNextPage] = useState<string|null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const [selected, setSelected] = useState<GmailMsg|null>(null)
  const [msgLoading, setMsgLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionMsg, setActionMsg] = useState('')

  // Compose
  const [compose, setCompose] = useState<{
    mode: 'new'|'reply'|'forward'; msgId?: string; threadId?: string
    to: string; cc: string; bcc: string; subject: string
    body: string; attachments: {filename:string;mimeType:string;data:string;size:number}[]
    showCc: boolean; showBcc: boolean
  }|null>(null)
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Import przetargów
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')
  const [importedPrzetargi, setImportedPrzetargi] = useState<{id:string;tytul:string}[]>([])

  const FILTERS = [
    {label:'📥 Odebrane', q:'in:inbox'},
    {label:'📬 Nieprzeczytane', q:'in:inbox is:unread'},
    {label:'⭐ Oznaczone', q:'is:starred'},
    {label:'❗ Ważne', q:'is:important'},
    {label:'📅 Rezerwacje', q:'rezerwacja OR rezerwacje OR stolik OR wesele OR bankiet'},
    {label:'🚚 Dostawy', q:'dostawa OR zamówienie OR dostawca OR hurtownia'},
    {label:'🧾 Faktury', q:'faktura OR płatność OR przelew'},
    {label:'📤 Wysłane', q:'in:sent'},
    {label:'🗑 Kosz', q:'in:trash'},
  ]

  async function loadMail(q: string, pageToken?: string) {
    if (pageToken) setLoadingMore(true); else { setLoading(true); setMessages([]) }
    setQuery(q)
    const url = `/api/google/gmail?userId=${userId}&action=list&max=50&q=${encodeURIComponent(q)}${pageToken?'&pageToken='+pageToken:''}`
    const r = await fetch(url)
    const j = await r.json()
    if (!j.messages?.length) { setLoading(false); setLoadingMore(false); return }
    // Pobierz metadane
    const ids = j.messages.map((m:any)=>m.id).join(',')
    const mr = await fetch(`/api/google/gmail?userId=${userId}&action=metadata&ids=${ids}`)
    const mj = await mr.json()
    if (pageToken) setMessages(prev=>[...prev,...(mj.messages??[])])
    else setMessages(mj.messages??[])
    setNextPage(j.nextPageToken??null)
    setLoading(false); setLoadingMore(false)
  }

  async function openMessage(id: string) {
    setMsgLoading(true)
    const r = await fetch(`/api/google/gmail?userId=${userId}&action=message&id=${id}`)
    const j = await r.json()
    setSelected(j)
    // Oznacz jako przeczytane
    if (messages.find(m=>m.id===id)?.unread) {
      await fetch('/api/google/gmail',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,messageIds:[id],action:'markRead'})})
      setMessages(prev=>prev.map(m=>m.id===id?{...m,unread:false,labelIds:(m.labelIds??[]).filter(l=>l!=='UNREAD')}:m))
    }
    setMsgLoading(false)
  }

  async function bulkAction(action: string) {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    await fetch('/api/google/gmail',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,messageIds:ids,action})})
    if (action==='trash') setMessages(prev=>prev.filter(m=>!selectedIds.has(m.id)))
    if (action==='markRead') setMessages(prev=>prev.map(m=>selectedIds.has(m.id)?{...m,unread:false}:m))
    if (action==='markUnread') setMessages(prev=>prev.map(m=>selectedIds.has(m.id)?{...m,unread:true}:m))
    if (action==='star') setMessages(prev=>prev.map(m=>selectedIds.has(m.id)?{...m,labelIds:[...(m.labelIds??[]),'STARRED']}:m))
    setSelectedIds(new Set()); setActionMsg(`Wykonano: ${action} (${ids.length})`)
    setTimeout(()=>setActionMsg(''), 3000)
  }

  async function deletePermanently(ids: string[]) {
    if (!confirm(`Trwale usunąć ${ids.length} wiadomość(i)?`)) return
    await fetch('/api/google/gmail',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,messageIds:ids})})
    setMessages(prev=>prev.filter(m=>!ids.includes(m.id)))
    if (selected && ids.includes(selected.id)) setSelected(null)
    setSelectedIds(new Set())
  }

  async function importPrzetargi(ids: string[]) {
    setImporting(true); setImportResult(''); setImportedPrzetargi([])
    const r = await fetch('/api/google/import-przetarg',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,messageIds:ids})})
    const j = await r.json()
    setImportResult(j.komunikat ?? (j.dodano>0?`✓ Dodano ${j.dodano} przetarg(i)`:j.duplikaty>0?'Już istnieją w systemie':'Brak przetargów'))
    if (j.przetargi?.length) setImportedPrzetargi(j.przetargi)
    setSelectedIds(new Set()); setImporting(false)
    setTimeout(()=>{ setImportResult(''); setImportedPrzetargi([]) }, 12000)
  }

  function openCompose(mode:'new'|'reply'|'forward', msg?: GmailMsg) {
    const headers = msg?.payload?.headers ?? []
    const from = getHeader(headers,'From')
    const subject = getHeader(headers,'Subject')

    let body = ''
    if (msg && mode==='reply') {
      const parts = extractParts(msg.payload)
      const orig = parts.plain || ''
      body = `\n\n--- Oryginalna wiadomość ---\nOd: ${from}\n\n${orig.substring(0,2000)}`
    }
    if (msg && mode==='forward') {
      const parts = extractParts(msg.payload)
      const orig = parts.plain || ''
      body = `\n\n--- Przekazana wiadomość ---\nOd: ${from}\nTemat: ${subject}\n\n${orig.substring(0,2000)}`
    }

    setCompose({
      mode, msgId: msg?.id, threadId: msg?.threadId,
      to: mode==='reply' ? from : '',
      cc: '', bcc: '',
      subject: mode==='reply' ? `Re: ${subject}` : mode==='forward' ? `Fwd: ${subject}` : '',
      body,
      attachments: [],
      showCc: false, showBcc: false,
    })
  }

  async function addAttachment(file: File) {
    const data = await new Promise<string>((res,rej) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(',')[1])
      r.onerror = rej
      r.readAsDataURL(file)
    })
    setCompose(prev=>prev?{...prev,attachments:[...prev.attachments,{filename:file.name,mimeType:file.type||'application/octet-stream',data,size:file.size}]}:prev)
  }

  async function sendMail() {
    if (!compose||!compose.to||!compose.subject||!compose.body) return
    setSending(true)
    const r = await fetch('/api/google/gmail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      userId, action:'send',
      to:compose.to, cc:compose.cc||undefined, bcc:compose.bcc||undefined,
      subject:compose.subject, bodyText:compose.body,
      attachments:compose.attachments,
      threadId:compose.threadId,
    })})
    const j = await r.json()
    if (j.ok) { setCompose(null); setActionMsg('✓ Wysłano!'); setTimeout(()=>setActionMsg(''),4000) }
    else setActionMsg(`⚠ Błąd: ${j.error}`)
    setSending(false)
  }

  const toggleSel = (id:string) => setSelectedIds(prev=>{ const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s })
  const allSelected = messages.length>0 && messages.every(m=>selectedIds.has(m.id))
  const someSelected = selectedIds.size>0 && !allSelected

  // ── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Powiadomienia */}
      {actionMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-2.5 rounded-xl mb-3">
          {actionMsg}
        </div>
      )}
      {importResult && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-3">
          <p className="text-sm font-medium text-purple-800 mb-2">{importResult}</p>
          {importedPrzetargi.length > 0 && (
            <div className="space-y-1.5">
              {importedPrzetargi.map(p => (
                <a key={p.id} href="/przetargi" 
                  className="flex items-center gap-2 text-xs bg-white border border-purple-200 rounded-lg px-3 py-2 hover:bg-purple-50 text-purple-700">
                  <span>📋</span>
                  <span className="truncate flex-1">{p.tytul}</span>
                  <span className="text-purple-400 flex-shrink-0">→ Przetargi</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4 h-full min-h-0">
        {/* ── LEWA KOLUMNA: lista ── */}
        <div className="w-full md:w-80 lg:w-96 flex flex-col flex-shrink-0">
          {/* Górny toolbar */}
          <div className="flex gap-2 mb-3">
            <button onClick={()=>openCompose('new')} className="flex-1 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">✏ Napisz</button>
            <button onClick={()=>loadMail(query)} className="border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm">🔄</button>
          </div>

          {/* Szukaj */}
          <div className="flex gap-2 mb-3">
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Szukaj w mailach..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              onKeyDown={e=>e.key==='Enter'&&loadMail(query)}/>
            <button onClick={()=>loadMail(query)} className="bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200 text-sm">🔍</button>
          </div>

          {/* Filtry */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {FILTERS.map(f=>(
              <button key={f.q} onClick={()=>loadMail(f.q)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${query===f.q?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Pasek akcji dla zaznaczonych */}
          {selectedIds.size>0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-3">
              <p className="text-xs font-semibold text-blue-800 mb-2">Zaznaczono: {selectedIds.size}</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={()=>bulkAction('markRead')} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">✓ Przeczytane</button>
                <button onClick={()=>bulkAction('markUnread')} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">● Nieprzeczytane</button>
                <button onClick={()=>bulkAction('star')} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">⭐ Oznacz</button>
                <button onClick={()=>bulkAction('trash')} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">🗑 Kosz</button>
                <button onClick={()=>deletePermanently(Array.from(selectedIds))} className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg hover:bg-red-200">🗑 Usuń</button>
              </div>
            </div>
          )}

          {/* Zaznacz wszystkie */}
          {messages.length>0 && (
            <div className="flex items-center gap-2 px-1 mb-2">
              <input type="checkbox" checked={allSelected}
                ref={el=>{if(el)el.indeterminate=someSelected}}
                onChange={()=>allSelected?setSelectedIds(new Set()):setSelectedIds(new Set(messages.map(m=>m.id)))}
                className="w-4 h-4 rounded border-gray-300 cursor-pointer"/>
              <span className="text-xs text-gray-400">{allSelected?'Odznacz':'Zaznacz wszystkie'} ({messages.length})</span>
            </div>
          )}

          {/* Lista maili */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                <span className="text-sm text-gray-400">Ładowanie...</span>
              </div>
            ) : messages.length===0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-2">✉</p>
                <p className="text-sm text-gray-400">Brak wiadomości</p>
                <button onClick={()=>loadMail('in:inbox')} className="text-xs text-blue-600 hover:underline mt-2">Pokaż odebrane</button>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
                {messages.map(m=>{
                  const isUnread = m.unread||m.labelIds?.includes('UNREAD')
                  const isStarred = m.labelIds?.includes('STARRED')
                  const from = m.from?.replace(/<.*>/,'').trim()||m.from||'?'
                  const isSelected = selected?.id===m.id
                  return (
                    <div key={m.id}
                      className={`flex items-start px-3 py-3 transition-colors cursor-pointer group ${isSelected?'bg-blue-50 border-l-4 border-l-blue-500':selectedIds.has(m.id)?'bg-blue-50':'hover:bg-gray-50'}`}>
                      {/* Checkbox */}
                      <input type="checkbox" checked={selectedIds.has(m.id)} onChange={e=>{e.stopPropagation();toggleSel(m.id)}}
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer mt-1 mr-2.5 flex-shrink-0"/>
                      {/* Avatar */}
                      <div onClick={()=>openMessage(m.id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mr-2.5 ${isUnread?'bg-blue-600 text-white':'bg-gray-100 text-gray-500'}`}>
                        {from.charAt(0).toUpperCase()}
                      </div>
                      {/* Treść */}
                      <div className="flex-1 min-w-0" onClick={()=>openMessage(m.id)}>
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className={`text-xs truncate ${isUnread?'font-semibold text-gray-900':'text-gray-700'}`}>{from}</p>
                          <p className="text-xs text-gray-400 flex-shrink-0">{m.date??''}</p>
                        </div>
                        <p className={`text-xs truncate ${isUnread?'font-semibold text-gray-800':'text-gray-600'}`}>{m.subject??'(bez tematu)'}</p>
                        {m.snippet && <p className="text-xs text-gray-400 truncate mt-0.5">{m.snippet}</p>}
                      </div>
                      {/* Star */}
                      <button onClick={async e=>{e.stopPropagation();await bulkAction(isStarred?'unstar':'star')}} className={`ml-1 mt-0.5 flex-shrink-0 text-sm ${isStarred?'text-yellow-400':'text-gray-200 group-hover:text-gray-300'}`}>★</button>
                    </div>
                  )
                })}
                {nextPage && (
                  <div className="p-3 text-center">
                    <button onClick={()=>loadMail(query,nextPage)} disabled={loadingMore}
                      className="text-sm text-blue-600 hover:underline disabled:opacity-50">
                      {loadingMore?'Ładowanie...':'Załaduj więcej →'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── PRAWA KOLUMNA: podgląd maila ── */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden h-full flex flex-col">
              {/* Header maila */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="text-base font-semibold text-gray-900 flex-1 leading-snug">
                    {selected.payload ? getHeader(selected.payload.headers,'Subject') : '...'}
                  </h2>
                  <button onClick={()=>setSelected(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">✕</button>
                </div>
                {selected.payload && (
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p><span className="font-medium">Od:</span> {getHeader(selected.payload.headers,'From')}</p>
                    <p><span className="font-medium">Do:</span> {getHeader(selected.payload.headers,'To')}</p>
                    <p><span className="font-medium">Data:</span> {getHeader(selected.payload.headers,'Date')}</p>
                  </div>
                )}
                {/* Akcje maila */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={()=>openCompose('reply',selected)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">↩ Odpowiedz</button>
                  <button onClick={()=>openCompose('reply',{...selected,payload:{...selected.payload!,headers:[...selected.payload!.headers,{name:'From',value:getHeader(selected.payload!.headers,'From')}]}})} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">↩↩ Odpowiedz wszystkim</button>
                  <button onClick={()=>openCompose('forward',selected)} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">→ Prześlij dalej</button>
                  <button onClick={()=>bulkAction('star')} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">⭐ Oznacz</button>
                  <button onClick={()=>deletePermanently([selected.id])} className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50">🗑 Usuń</button>
                  <a href={`https://mail.google.com/mail/u/0/#inbox/${selected.threadId}`} target="_blank" rel="noopener noreferrer" className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">↗ Gmail</a>
                </div>
              </div>

              {/* Treść */}
              {msgLoading ? (
                <div className="flex-1 flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                  <span className="text-sm text-gray-400">Ładowanie...</span>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-6">
                  {(() => {
                    const parts = extractParts(selected.payload)
                    return (
                      <>
                        {parts.html
                          ? <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{__html:parts.html}}/>
                          : parts.plain
                            ? <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{parts.plain}</pre>
                            : <p className="text-gray-400 italic text-sm">Brak treści</p>
                        }
                        {/* Załączniki */}
                        {parts.attachments.length>0 && (
                          <div className="mt-6 pt-4 border-t border-gray-100">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">📎 Załączniki ({parts.attachments.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {parts.attachments.map((att,i)=>(
                                <button key={i} onClick={async()=>{
                                  const r = await fetch(`/api/google/gmail?userId=${userId}&action=attachment&msgId=${selected.id}&attId=${att.attachmentId}`)
                                  const j = await r.json()
                                  if (j.data) {
                                    const a = document.createElement('a')
                                    a.href = `data:${att.mimeType};base64,${j.data.replace(/-/g,'+').replace(/_/g,'/')}`
                                    a.download = att.filename
                                    a.click()
                                  }
                                }} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm hover:bg-gray-100 transition-colors">
                                  <span>📎</span>
                                  <span className="truncate max-w-40">{att.filename}</span>
                                  <span className="text-xs text-gray-400">{Math.round(att.size/1024)}KB</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-5xl mb-3">✉</p>
                <p className="text-gray-500 font-medium">Wybierz wiadomość</p>
                <p className="text-sm text-gray-400 mt-1">Kliknij mail na liście aby go otworzyć</p>
                {messages.length===0 && (
                  <button onClick={()=>loadMail('in:inbox')} className="mt-4 text-sm text-blue-600 hover:underline">
                    Załaduj odebrane →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── OKNO COMPOSE ── */}
      {compose && (
        <div className="fixed bottom-0 right-6 z-50 w-full max-w-xl bg-white border border-gray-300 rounded-t-2xl shadow-2xl">
          <div className="flex items-center justify-between bg-gray-900 text-white px-4 py-3 rounded-t-2xl">
            <span className="text-sm font-medium">
              {compose.mode==='reply'?'Odpowiedź':compose.mode==='forward'?'Przekaż dalej':'Nowa wiadomość'}
            </span>
            <div className="flex gap-2">
              <button onClick={()=>setCompose(null)} className="text-gray-300 hover:text-white text-lg leading-none">✕</button>
            </div>
          </div>
          <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
            {/* Do */}
            <div className="flex items-center border-b border-gray-100 pb-2">
              <span className="text-xs text-gray-400 w-6 flex-shrink-0">Do</span>
              <input value={compose.to} onChange={e=>setCompose(p=>p?{...p,to:e.target.value}:p)}
                className="flex-1 text-sm focus:outline-none px-2" placeholder="email@firma.pl"/>
              <div className="flex gap-2 text-xs text-gray-400">
                <button onClick={()=>setCompose(p=>p?{...p,showCc:!p.showCc}:p)} className="hover:text-gray-600">DW</button>
                <button onClick={()=>setCompose(p=>p?{...p,showBcc:!p.showBcc}:p)} className="hover:text-gray-600">UDW</button>
              </div>
            </div>
            {compose.showCc && (
              <div className="flex items-center border-b border-gray-100 pb-2">
                <span className="text-xs text-gray-400 w-6 flex-shrink-0">DW</span>
                <input value={compose.cc} onChange={e=>setCompose(p=>p?{...p,cc:e.target.value}:p)}
                  className="flex-1 text-sm focus:outline-none px-2"/>
              </div>
            )}
            {compose.showBcc && (
              <div className="flex items-center border-b border-gray-100 pb-2">
                <span className="text-xs text-gray-400 w-6 flex-shrink-0">UDW</span>
                <input value={compose.bcc} onChange={e=>setCompose(p=>p?{...p,bcc:e.target.value}:p)}
                  className="flex-1 text-sm focus:outline-none px-2"/>
              </div>
            )}
            {/* Temat */}
            <div className="flex items-center border-b border-gray-100 pb-2">
              <span className="text-xs text-gray-400 w-12 flex-shrink-0">Temat</span>
              <input value={compose.subject} onChange={e=>setCompose(p=>p?{...p,subject:e.target.value}:p)}
                className="flex-1 text-sm focus:outline-none px-2"/>
            </div>
            {/* Treść */}
            <textarea value={compose.body} onChange={e=>setCompose(p=>p?{...p,body:e.target.value}:p)}
              rows={8} className="w-full text-sm focus:outline-none resize-none" placeholder="Treść wiadomości..."/>
            {/* Załączniki */}
            {compose.attachments.length>0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                {compose.attachments.map((a,i)=>(
                  <span key={i} className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 py-1 text-xs">
                    📎 {a.filename} ({Math.round(a.size/1024)}KB)
                    <button onClick={()=>setCompose(p=>p?{...p,attachments:p.attachments.filter((_,j)=>j!==i)}:p)} className="text-gray-400 hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Footer compose */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button onClick={sendMail} disabled={!compose.to||!compose.subject||sending}
                className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {sending?'⏳ Wysyłanie...':'📤 Wyślij'}
              </button>
              <button onClick={()=>fileInputRef.current?.click()} className="text-gray-500 hover:text-gray-700 text-xl" title="Dodaj załącznik">📎</button>
              <input ref={fileInputRef} type="file" className="hidden" multiple
                onChange={e=>{ Array.from(e.target.files??[]).forEach(addAttachment); e.target.value='' }}/>
            </div>
            <button onClick={()=>setCompose(null)} className="text-gray-400 hover:text-red-500 text-xl" title="Zamknij">🗑</button>
          </div>
        </div>
      )}
    </div>
  )
}
