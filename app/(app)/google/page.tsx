'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import GmailClient from '@/components/GmailClient'
import { createClient } from '@/lib/supabase'

// ─── TYPY ────────────────────────────────────────────────────────────────────
type CalEvent = {
  id: string; summary: string; description?: string; location?: string
  start: { dateTime?: string; date?: string }
  end:   { dateTime?: string; date?: string }
  htmlLink?: string; colorId?: string
}

type GTask = {
  id: string; title: string; notes?: string; due?: string
  status: 'needsAction' | 'completed'; completed?: string
  listId?: string
}

type GmailMsg = {
  id: string; threadId: string; snippet?: string
  subject?: string; from?: string; date?: string
  unread?: boolean; labelIds?: string[]
  payload?: { headers: {name:string;value:string}[]; body?:{data?:string}; parts?:{mimeType:string;body?:{data?:string}}[] }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getHeader(h: {name:string;value:string}[], name: string) {
  return h.find(x => x.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function decodeB64(s: string) {
  try {
    return decodeURIComponent(
      atob(s.replace(/-/g,'+').replace(/_/g,'/'))
        .split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')
    )
  } catch { return '' }
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pl-PL', { weekday:'short', day:'numeric', month:'short' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' })
}
function fmtRelative(ts: string) {
  if (!ts) return ''
  const d = new Date(parseInt(ts)), now = new Date()
  const diff = Math.floor((now.getTime()-d.getTime())/86400000)
  if (diff===0) return d.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})
  if (diff===1) return 'wczoraj'
  if (diff<7) return d.toLocaleDateString('pl-PL',{weekday:'short'})
  return d.toLocaleDateString('pl-PL',{day:'numeric',month:'short'})
}

const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white"

// ─── GŁÓWNY KOMPONENT ─────────────────────────────────────────────────────────
export default function GooglePage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string|null>(null)
  const [connected, setConnected] = useState(false)
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<'calendar'|'tasks'|'gmail'>('calendar')

  // Kalendarz
  const [events, setEvents] = useState<CalEvent[]>([])
  const [calLoading, setCalLoading] = useState(false)
  const [selEvents, setSelEvents] = useState<Set<string>>(new Set())
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [newTimeStart, setNewTimeStart] = useState('09:00')
  const [newTimeEnd, setNewTimeEnd] = useState('10:00')
  const [newDesc, setNewDesc] = useState('')
  const [newLoc, setNewLoc] = useState('')
  const [newAllDay, setNewAllDay] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)

  // Zadania
  const [tasks, setTasks] = useState<GTask[]>([])
  const [taskListId, setTaskListId] = useState('@default')
  const [taskLists, setTaskLists] = useState<{id:string;title:string}[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [selTasks, setSelTasks] = useState<Set<string>>(new Set())
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [newTaskNotes, setNewTaskNotes] = useState('')
  const [savingTask, setSavingTask] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  // Gmail
  const [messages, setMessages] = useState<GmailMsg[]>([])
  const [gmailLoading, setGmailLoading] = useState(false)
  const [gmailQuery, setGmailQuery] = useState('in:inbox')
  const [selMsgs, setSelMsgs] = useState<Set<string>>(new Set())
  const [selectedMsg, setSelectedMsg] = useState<GmailMsg|null>(null)
  const [msgLoading, setMsgLoading] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [composeTo, setComposeTo] = useState('')
  const [composeSubj, setComposeSubj] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendOk, setSendOk] = useState('')
  const [importMsg, setImportMsg] = useState('')

  // Init
  const [googleError, setGoogleError] = useState<string|null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => { if (data.user) setUserId(data.user.id) })
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_connected')) window.history.replaceState({}, '', '/google')
    const err = params.get('google_error')
    if (err) { setGoogleError(decodeURIComponent(err)); window.history.replaceState({}, '', '/google') }
  }, [])

  useEffect(() => { if (userId) checkConn() }, [userId])

  useEffect(() => {
    if (!connected) return
    if (tab==='calendar') loadCal()
    if (tab==='tasks') loadTasks()
    if (tab==='gmail') loadGmail(gmailQuery)
  }, [tab, connected])

  async function checkConn() {
    setChecking(true)
    // Szukamy dowolnego tokenu w systemie — w małym CRM jest jedno konto Google
    const { data } = await supabase.from('user_google_tokens').select('user_id').limit(1).maybeSingle()
    setConnected(!!data)
    if (data) loadCal()
    setChecking(false)
  }

  // ── KALENDARZ ─────────────────────────────────────────────────────────────
  async function loadCal() {
    setCalLoading(true)
    const r = await fetch(`/api/google/calendar?userId=${userId}`)
    const j = await r.json()
    if (j.events) setEvents(j.events)
    setCalLoading(false)
  }

  async function addEvent() {
    if (!newTitle || !newDate) return
    setSavingEvent(true)
    const ev: any = { summary: newTitle, description: newDesc||undefined, location: newLoc||undefined }
    if (newAllDay) { ev.start={date:newDate}; ev.end={date:newDate} }
    else { ev.start={dateTime:`${newDate}T${newTimeStart}:00`,timeZone:'Europe/Warsaw'}; ev.end={dateTime:`${newDate}T${newTimeEnd}:00`,timeZone:'Europe/Warsaw'} }
    const r = await fetch('/api/google/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,event:ev})})
    const j = await r.json()
    if (j.event) { setEvents(prev=>[j.event,...prev]); resetEvForm() }
    setSavingEvent(false)
  }

  async function deleteEvents(ids: string[]) {
    if (!confirm(`Usunąć ${ids.length} wydarzenie(ia)?`)) return
    await Promise.all(ids.map(id=>fetch('/api/google/calendar',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,eventId:id})})))
    setEvents(prev=>prev.filter(e=>!ids.includes(e.id)))
    setSelEvents(new Set())
  }

  function resetEvForm() { setShowAddEvent(false); setNewTitle(''); setNewDesc(''); setNewLoc(''); setNewAllDay(false); setNewDate(new Date().toISOString().split('T')[0]); setNewTimeStart('09:00'); setNewTimeEnd('10:00') }

  // ── ZADANIA ───────────────────────────────────────────────────────────────
  const [tasksError, setTasksError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  async function loadTasks() {
    setTasksLoading(true); setTasksError('')
    try {
      const r = await fetch(`/api/google/tasks?userId=${userId}`)
      const j = await r.json()
      if (j.error === 'no_token') {
        setTasksError('Sesja Google wygasła. Rozłącz i połącz ponownie konto Google.')
      } else if (j.error) {
        setTasksError('Błąd Google Tasks: ' + j.error)
      } else if (j.tasks) {
        setTasks(j.tasks); setTaskListId(j.listId); setTaskLists(j.lists??[])
      }
    } catch (e: any) {
      setTasksError('Błąd połączenia: ' + e.message)
    }
    setTasksLoading(false)
  }

  // Synchronizuj Google Tasks → crm_zadania
  async function syncTasksToCRM() {
    if (!tasks.length) { await loadTasks(); return }
    setSyncing(true); setSyncMsg('')
    try {
      const { createClient: mkSb } = await import('@/lib/supabase')
      const sb = mkSb()
      let dodano = 0, aktualizowano = 0
      for (const t of tasks) {
        const termin = t.due ? t.due.slice(0, 10) : null
        const status = t.status === 'completed' ? 'wykonane' : 'otwarte'
        const payload = {
          tytul: t.title,
          opis: t.notes ?? '',
          termin,
          status,
          priorytet: 'normalny',
          typ: 'zadanie',
          zrodlo: 'google_tasks',
          google_task_id: t.id,
        }
        // Upsert po google_task_id jeśli kolumna istnieje, inaczej insert
        const { data: existing } = await sb.from('crm_zadania')
          .select('id').eq('google_task_id', t.id).maybeSingle()
        if (existing) {
          await sb.from('crm_zadania').update(payload).eq('id', existing.id)
          aktualizowano++
        } else {
          const ins = await sb.from('crm_zadania').insert(payload)
          if (!ins.error) dodano++
        }
      }
      setSyncMsg(`✓ Zsynchronizowano: ${dodano} nowych, ${aktualizowano} zaktualizowanych`)
      setTimeout(() => setSyncMsg(''), 5000)
    } catch (e: any) {
      setSyncMsg('Błąd sync: ' + e.message)
    }
    setSyncing(false)
  }

  async function addTask() {
    if (!newTaskTitle) return
    setSavingTask(true)
    const task: any = { title: newTaskTitle, notes: newTaskNotes||undefined }
    if (newTaskDue) task.due = `${newTaskDue}T00:00:00.000Z`
    const r = await fetch('/api/google/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,task,listId:taskListId})})
    const j = await r.json()
    if (j.task) { setTasks(prev=>[j.task,...prev]); setNewTaskTitle(''); setNewTaskDue(''); setNewTaskNotes(''); setShowAddTask(false) }
    setSavingTask(false)
  }

  async function toggleTask(t: GTask) {
    const done = t.status==='needsAction'
    await fetch('/api/google/tasks',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,taskId:t.id,listId:taskListId,completed:done})})
    setTasks(prev=>prev.map(x=>x.id===t.id?{...x,status:done?'completed':'needsAction'}:x))
  }

  async function deleteTasks(ids: string[]) {
    if (!confirm(`Usunąć ${ids.length} zadanie(ia)?`)) return
    await Promise.all(ids.map(id=>fetch('/api/google/tasks',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,taskId:id,listId:taskListId})})))
    setTasks(prev=>prev.filter(t=>!ids.includes(t.id)))
    setSelTasks(new Set())
  }

  // ── GMAIL ─────────────────────────────────────────────────────────────────
  async function loadGmail(q: string) {
    setGmailLoading(true); setMessages([])
    const r = await fetch(`/api/google/gmail?userId=${userId}&action=list&q=${encodeURIComponent(q)}&max=50`)
    const j = await r.json()
    if (!j.messages?.length) { setGmailLoading(false); return }
    const ids = j.messages.map((m:any)=>m.id).join(',')
    const mr = await fetch(`/api/google/gmail?userId=${userId}&action=metadata&ids=${ids}`)
    const mj = await mr.json()
    if (mj.messages) setMessages(mj.messages)
    else setMessages(j.messages)
    setGmailLoading(false)
  }

  async function loadMessage(id: string) {
    setMsgLoading(true)
    const r = await fetch(`/api/google/gmail?userId=${userId}&action=message&id=${id}`)
    const j = await r.json()
    setSelectedMsg(j); setMsgLoading(false)
  }

  async function sendMail() {
    if (!composeTo||!composeSubj||!composeBody) return
    setSending(true)
    const r = await fetch('/api/google/gmail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,to:composeTo,subject:composeSubj,body:composeBody})})
    const j = await r.json()
    if (j.ok) { setSendOk('Wysłano!'); setTimeout(()=>setSendOk(''),4000); setShowCompose(false); setComposeTo(''); setComposeSubj(''); setComposeBody('') }
    setSending(false)
  }

  // Importuj mail jako przetargi
  async function importujJakoPrzetarg(m: GmailMsg) {
    if (!m.payload) { setImportMsg('Brak treści maila'); return }
    const headers = m.payload.headers
    const subject = getHeader(headers,'Subject')
    const from = getHeader(headers,'From')
    let body = ''
    if (m.payload.parts) {
      const txt = m.payload.parts.find(p=>p.mimeType==='text/plain')
      const html = m.payload.parts.find(p=>p.mimeType==='text/html')
      body = txt?.body?.data ? decodeB64(txt.body.data) : html?.body?.data ? decodeB64(html.body.data).replace(/<[^>]+>/g,' ') : ''
    } else if (m.payload.body?.data) {
      body = decodeB64(m.payload.body.data)
    }

    const r = await fetch('https://uonrijvmqelsgoclfnqh.supabase.co/functions/v1/email-przetargi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, from, text: body }),
    })
    const j = await r.json()
    setImportMsg(j.dodano > 0 ? `✓ Dodano ${j.dodano} przetarg(i) do modułu Przetargi` : j.duplikaty > 0 ? 'Przetarg już istnieje w systemie' : 'Nie rozpoznano przetargu w tym mailu')
    setTimeout(()=>setImportMsg(''), 5000)
  }

  // Zaznacz wszystkie / odznacz
  const toggleSelEvent = (id:string) => setSelEvents(prev=>{ const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s })
  const toggleSelTask  = (id:string) => setSelTasks(prev=>{ const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s })
  const toggleSelMsg   = (id:string) => setSelMsgs(prev=>{ const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s })

  // ── EKRAN LOGOWANIA ────────────────────────────────────────────────────────
  if (checking) return <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>

  if (!connected) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-10 max-w-md w-full text-center shadow-sm">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <span className="text-3xl">G</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Google Workspace</h1>
        <p className="text-sm text-gray-500 mb-4">Połącz konto Google aby korzystać z Kalendarza, Zadań i Gmaila.</p>
        <ul className="text-xs text-gray-400 mb-6 space-y-1.5 text-left bg-gray-50 rounded-xl p-4">
          <li>📅 Google Calendar — przeglądaj, dodawaj, usuwaj, checkboxy</li>
          <li>✅ Google Tasks — zarządzaj zadaniami, oznaczaj ukończone</li>
          <li>✉ Gmail — czytaj, wysyłaj, importuj przetargi z maili</li>
          <li>📥 Maile zbiorcze ORLEN → osobne przetargi automatycznie</li>
        </ul>
        {googleError && (
          <div className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-left">
            ⚠ Błąd połączenia: {googleError}
          </div>
        )}
        <button
          onClick={() => { if (userId) window.location.href = `/api/google/auth?userId=${userId}` }}
          disabled={!userId}
          className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50">
          {userId ? 'Połącz Google' : 'Ładowanie...'}
        </button>
        <p className="text-xs text-gray-400 mt-3">Wymagane: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET w Vercel</p>
      </div>
    </div>
  )

  // Zgrupuj eventy po dniu
  const eventsByDay = events.reduce((acc,e)=>{ const d=(e.start.dateTime??e.start.date??'').split('T')[0]; (acc[d]??=[]).push(e); return acc },{} as Record<string,CalEvent[]>)
  const activeTasks  = tasks.filter(t=>t.status==='needsAction')
  const doneTasks    = tasks.filter(t=>t.status==='completed')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Google Workspace</h1>
            <p className="text-xs text-gray-400">Kalendarz · Zadania · Gmail</p>
          </div>
          <div className="flex gap-2 items-center">
            {tab==='gmail'    && <button onClick={()=>setShowCompose(true)} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">✏ Napisz</button>}
            {tab==='calendar' && <button onClick={()=>setShowAddEvent(true)} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">+ Wydarzenie</button>}
            {tab==='tasks'    && <>
              <button onClick={syncTasksToCRM} disabled={syncing || tasksLoading}
                className="text-sm border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
                {syncing ? '⏳' : '🔄'} Sync → CRM
              </button>
              <button onClick={()=>setShowAddTask(true)} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">+ Zadanie</button>
            </>}
            <button onClick={async () => {
              if (!confirm('Odłączyć konto Google i połączyć inne?')) return
              await fetch(`/api/google/auth?action=disconnect`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId }) })
              setConnected(false)
            }} className="text-xs text-gray-400 hover:text-red-600 border border-gray-200 px-3 py-2 rounded-lg hover:border-red-200 transition-colors">
              🔄 Zmień konto
            </button>
          </div>
        </div>
        <div className="flex gap-1 mt-3 -mb-4">
          {(['calendar','tasks','gmail'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab===t?'border-gray-900 text-gray-900':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t==='calendar'?'📅 Kalendarz':t==='tasks'?`✅ Zadania (${activeTasks.length})`:'✉ Gmail'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 w-full">
        {sendOk  && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">✓ {sendOk}</div>}
        {importMsg && <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-3 rounded-xl">{importMsg}</div>}

        {/* ══════════════ KALENDARZ ══════════════ */}
        {tab==='calendar' && (
          <>
            {/* Pasek akcji dla zaznaczonych */}
            {selEvents.size>0 && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 flex-wrap">
                <span className="text-sm font-medium text-blue-800">Zaznaczono: {selEvents.size}</span>
                <button onClick={()=>deleteEvents(Array.from(selEvents))} className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700">🗑 Usuń zaznaczone</button>
                <button onClick={()=>setSelEvents(new Set())} className="text-xs text-blue-600 hover:underline ml-auto">Odznacz</button>
              </div>
            )}

            {/* Formularz dodawania */}
            {showAddEvent && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Nowe wydarzenie</h2>
                  <button onClick={resetEvForm} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div className="space-y-3">
                  <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Tytuł *" className={inputCls} autoFocus />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 block mb-1">Data *</label>
                      <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} className={inputCls} />
                    </div>
                    {!newAllDay && <>
                      <div><label className="text-xs text-gray-500 block mb-1">Od</label><input type="time" value={newTimeStart} onChange={e=>setNewTimeStart(e.target.value)} className={inputCls} /></div>
                      <div><label className="text-xs text-gray-500 block mb-1">Do</label><input type="time" value={newTimeEnd} onChange={e=>setNewTimeEnd(e.target.value)} className={inputCls} /></div>
                    </>}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={newAllDay} onChange={e=>setNewAllDay(e.target.checked)} className="rounded"/> Cały dzień</label>
                  <input value={newLoc} onChange={e=>setNewLoc(e.target.value)} placeholder="Lokalizacja" className={inputCls} />
                  <textarea value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="Opis" rows={2} className={`${inputCls} resize-none`} />
                  <div className="flex gap-2">
                    <button onClick={addEvent} disabled={!newTitle||!newDate||savingEvent} className="bg-blue-600 text-white text-sm px-6 py-2 rounded-lg disabled:opacity-50">{savingEvent?'⏳...':'✓ Dodaj'}</button>
                    <button onClick={resetEvForm} className="text-sm border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">Anuluj</button>
                  </div>
                </div>
              </div>
            )}

            {calLoading ? <p className="text-center text-gray-400 py-12">Ładowanie kalendarza...</p> :
             events.length===0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                <p className="text-4xl mb-2">📅</p><p className="text-gray-500">Brak nadchodzących wydarzeń</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Zaznacz wszystkie */}
                <div className="flex items-center gap-2 px-1">
                  <input type="checkbox" checked={events.length>0&&selEvents.size===events.length}
                    ref={el=>{if(el)el.indeterminate=selEvents.size>0&&selEvents.size<events.length}}
                    onChange={()=>selEvents.size===events.length?setSelEvents(new Set()):setSelEvents(new Set(events.map(e=>e.id)))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"/>
                  <span className="text-xs text-gray-400">{selEvents.size===events.length?'Odznacz wszystkie':'Zaznacz wszystkie'}</span>
                </div>
                {Object.entries(eventsByDay).map(([day,dayEvents])=>(
                  <div key={day}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        {new Date(day).toLocaleDateString('pl-PL',{weekday:'short',day:'numeric',month:'short'})}
                      </span>
                    </div>
                    <div className="space-y-2 ml-2">
                      {dayEvents.map(e=>(
                        <div key={e.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 group transition-all ${selEvents.has(e.id)?'border-blue-400 ring-2 ring-blue-200':'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
                          <input type="checkbox" checked={selEvents.has(e.id)} onChange={()=>toggleSelEvent(e.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer mt-0.5 flex-shrink-0"/>
                          <div className="flex-shrink-0 min-w-16 text-center">
                            <p className="text-sm font-bold text-blue-700">{e.start.dateTime?fmtTime(e.start.dateTime):'Cały dzień'}</p>
                            {e.end.dateTime && <p className="text-xs text-gray-400">{fmtTime(e.end.dateTime)}</p>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{e.summary}</p>
                            {e.location && <p className="text-xs text-gray-500 mt-0.5">📍 {e.location}</p>}
                            {e.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{e.description}</p>}
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {e.htmlLink && <a href={e.htmlLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-lg">GCal ↗</a>}
                            <button onClick={()=>deleteEvents([e.id])} className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100">🗑</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════════ ZADANIA ══════════════ */}
        {tab==='tasks' && (
          <>
            {tasksError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                <span>⚠</span>
                <div>
                  <p className="font-medium">Błąd ładowania zadań</p>
                  <p>{tasksError}</p>
                  {tasksError.includes('wygasła') && (
                    <button onClick={async () => {
                      await fetch('/api/google/auth?action=disconnect', { method: 'POST' })
                      setConnected(false)
                    }} className="mt-2 text-xs underline">Przejdź do ponownego połączenia →</button>
                  )}
                </div>
              </div>
            )}
            {syncMsg && (
              <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${syncMsg.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {syncMsg}
              </div>
            )}
            {selTasks.size>0 && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 flex-wrap">
                <span className="text-sm font-medium text-blue-800">Zaznaczono: {selTasks.size}</span>
                <button onClick={async()=>{
                  const ids=Array.from(selTasks)
                  await Promise.all(ids.map(id=>fetch('/api/google/tasks',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,taskId:id,listId:taskListId,completed:true})})))
                  setTasks(prev=>prev.map(t=>selTasks.has(t.id)?{...t,status:'completed' as const}:t)); setSelTasks(new Set())
                }} className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">✓ Oznacz ukończone</button>
                <button onClick={()=>deleteTasks(Array.from(selTasks))} className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700">🗑 Usuń</button>
                <button onClick={()=>setSelTasks(new Set())} className="text-xs text-blue-600 hover:underline ml-auto">Odznacz</button>
              </div>
            )}

            {/* Formularz nowego zadania */}
            {showAddTask && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Nowe zadanie</h2>
                  <button onClick={()=>setShowAddTask(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div className="space-y-3">
                  <input value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)} placeholder="Tytuł zadania *" className={inputCls} autoFocus />
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Termin (opcjonalnie)</label>
                    <input type="date" value={newTaskDue} onChange={e=>setNewTaskDue(e.target.value)} className={inputCls} />
                  </div>
                  <textarea value={newTaskNotes} onChange={e=>setNewTaskNotes(e.target.value)} placeholder="Notatki" rows={2} className={`${inputCls} resize-none`} />
                  <div className="flex gap-2">
                    <button onClick={addTask} disabled={!newTaskTitle||savingTask} className="bg-blue-600 text-white text-sm px-6 py-2 rounded-lg disabled:opacity-50">{savingTask?'⏳...':'✓ Dodaj'}</button>
                    <button onClick={()=>setShowAddTask(false)} className="text-sm border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">Anuluj</button>
                  </div>
                </div>
              </div>
            )}

            {tasksLoading ? <p className="text-center text-gray-400 py-12">Ładowanie zadań...</p> : (
              <div>
                {/* Aktywne zadania */}
                <div className="mb-2 flex items-center gap-2">
                  <input type="checkbox" checked={activeTasks.length>0&&activeTasks.every(t=>selTasks.has(t.id))}
                    ref={el=>{if(el)el.indeterminate=selTasks.size>0&&!activeTasks.every(t=>selTasks.has(t.id))&&activeTasks.some(t=>selTasks.has(t.id))}}
                    onChange={()=>activeTasks.every(t=>selTasks.has(t.id))?setSelTasks(new Set()):setSelTasks(new Set(activeTasks.map(t=>t.id)))}
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer"/>
                  <span className="text-xs text-gray-400">Zaznacz wszystkie aktywne ({activeTasks.length})</span>
                </div>
                <div className="space-y-2 mb-6">
                  {activeTasks.length===0 && (
                    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
                      <p className="text-3xl mb-2">✅</p><p className="text-gray-500">Brak aktywnych zadań</p>
                    </div>
                  )}
                  {activeTasks.map(t=>(
                    <div key={t.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 group transition-all ${selTasks.has(t.id)?'border-blue-400 ring-2 ring-blue-200':'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
                      <input type="checkbox" checked={selTasks.has(t.id)} onChange={()=>toggleSelTask(t.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer mt-0.5 flex-shrink-0"/>
                      <input type="checkbox" checked={false} onChange={()=>toggleTask(t)} className="w-4 h-4 rounded-full border-gray-300 cursor-pointer mt-0.5 flex-shrink-0" title="Oznacz jako ukończone"/>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{t.title}</p>
                        {t.due && <p className="text-xs text-orange-600 mt-0.5">📅 {new Date(t.due).toLocaleDateString('pl-PL')}</p>}
                        {t.notes && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{t.notes}</p>}
                      </div>
                      <button onClick={()=>deleteTasks([t.id])} className="opacity-0 group-hover:opacity-100 text-xs text-red-500 bg-red-50 px-2 py-1 rounded-lg">🗑</button>
                    </div>
                  ))}
                </div>

                {/* Ukończone */}
                {doneTasks.length>0 && (
                  <>
                    <button onClick={()=>setShowCompleted(!showCompleted)}
                      className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-3">
                      <span>{showCompleted?'▼':'▶'}</span> Ukończone ({doneTasks.length})
                    </button>
                    {showCompleted && (
                      <div className="space-y-2 opacity-60">
                        {doneTasks.map(t=>(
                          <div key={t.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-3 group">
                            <input type="checkbox" checked={true} onChange={()=>toggleTask(t)} className="w-4 h-4 rounded-full border-gray-300 cursor-pointer mt-0.5 flex-shrink-0" title="Przywróć"/>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-400 line-through">{t.title}</p>
                            </div>
                            <button onClick={()=>deleteTasks([t.id])} className="opacity-0 group-hover:opacity-100 text-xs text-red-400 bg-red-50 px-2 py-1 rounded-lg">🗑</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {tab==='gmail' && (
          <div className="flex-1">
            <GmailClient userId={userId!} />
          </div>
        )}
      </div>
    </div>
  )
}
