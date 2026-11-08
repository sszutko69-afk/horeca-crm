'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

type CalEvent = {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  description?: string
}

type GmailMsg = {
  id: string
  threadId: string
}

export default function GooglePanel({ compact = false }: { compact?: boolean }) {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [tab, setTab] = useState<'calendar' | 'gmail'>('calendar')
  const [events, setEvents] = useState<CalEvent[]>([])
  const [messages, setMessages] = useState<GmailMsg[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddEvent, setShowAddEvent] = useState(false)

  // Nowe wydarzenie
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('09:00')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
    // Sprawdź query param po powrocie z OAuth
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search)
      if (p.get('google_connected') === '1') setConnected(true)
    }
  }, [])

  useEffect(() => {
    if (userId) checkConnection()
  }, [userId])

  async function checkConnection() {
    const { data } = await supabase.from('user_google_tokens').select('user_id').eq('user_id', userId).maybeSingle()
    setConnected(!!data)
    if (data) loadCalendar()
  }

  async function loadCalendar() {
    setLoading(true)
    const res = await fetch(`/api/google/calendar?userId=${userId}`)
    const json = await res.json()
    if (json.events) setEvents(json.events)
    setLoading(false)
  }

  async function loadGmail() {
    setLoading(true)
    const res = await fetch(`/api/google/gmail?userId=${userId}&action=list&q=przetarg+OR+oferta+OR+zamowienie+OR+orlen+OR+lpg`)
    const json = await res.json()
    if (json.messages) setMessages(json.messages)
    setLoading(false)
  }

  async function addEvent() {
    if (!newTitle || !newDate) return
    setSaving(true)
    const start = newTime ? `${newDate}T${newTime}:00` : newDate
    const end = newTime ? `${newDate}T${String(parseInt(newTime)+1).padStart(2,'0')}:00:00` : newDate
    const res = await fetch('/api/google/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        event: {
          summary: newTitle,
          description: newDesc,
          start: newTime ? { dateTime: start, timeZone: 'Europe/Warsaw' } : { date: newDate },
          end: newTime ? { dateTime: end, timeZone: 'Europe/Warsaw' } : { date: newDate },
        }
      })
    })
    const json = await res.json()
    if (json.event) {
      setEvents(prev => [json.event, ...prev])
      setNewTitle(''); setNewDate(''); setNewTime('09:00'); setNewDesc('')
      setShowAddEvent(false)
    }
    setSaving(false)
  }

  async function deleteEvent(id: string) {
    await fetch('/api/google/calendar', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, eventId: id })
    })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  function connectGoogle() {
    window.location.href = `/api/google/auth?userId=${userId}`
  }

  const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white"

  if (!connected) {
    return (
      <div className={`bg-white border border-gray-200 rounded-xl p-5 ${compact ? '' : ''}`}>
        <div className="text-center">
          <p className="text-2xl mb-2">📅</p>
          <p className="text-sm font-medium text-gray-900 mb-1">Google Calendar & Gmail</p>
          <p className="text-xs text-gray-500 mb-4">Połącz konto Google aby zarządzać kalendarzem i mailami przetargowymi</p>
          <button onClick={connectGoogle}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 mx-auto">
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Połącz Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden ${compact ? 'max-h-80' : ''}`}>
      {/* Zakładki */}
      <div className="flex border-b border-gray-100">
        <button onClick={() => { setTab('calendar'); loadCalendar() }}
          className={`flex-1 py-2.5 text-xs font-medium ${tab==='calendar'?'bg-gray-50 border-b-2 border-gray-900 text-gray-900':'text-gray-500 hover:bg-gray-50'}`}>
          📅 Kalendarz
        </button>
        <button onClick={() => { setTab('gmail'); loadGmail() }}
          className={`flex-1 py-2.5 text-xs font-medium ${tab==='gmail'?'bg-gray-50 border-b-2 border-gray-900 text-gray-900':'text-gray-500 hover:bg-gray-50'}`}>
          ✉ Gmail
        </button>
      </div>

      <div className={`overflow-y-auto ${compact ? 'max-h-64' : 'max-h-96'}`}>
        {/* KALENDARZ */}
        {tab === 'calendar' && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500">Nadchodzące wydarzenia</span>
              <button onClick={() => setShowAddEvent(!showAddEvent)}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                + Dodaj
              </button>
            </div>

            {showAddEvent && (
              <div className="bg-blue-50 rounded-xl p-3 mb-3 space-y-2">
                <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Tytuł wydarzenia" className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} className={inputCls} />
                  <input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)} className={inputCls} />
                </div>
                <input value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="Opis (opcjonalnie)" className={inputCls} />
                <div className="flex gap-2">
                  <button onClick={addEvent} disabled={!newTitle||!newDate||saving}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                    {saving ? '⏳' : '✓ Dodaj'}
                  </button>
                  <button onClick={()=>setShowAddEvent(false)} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg">Anuluj</button>
                </div>
              </div>
            )}

            {loading ? <p className="text-xs text-center text-gray-400 py-4">Ładowanie...</p> :
              events.length === 0 ? <p className="text-xs text-center text-gray-400 py-4">Brak nadchodzących wydarzeń</p> :
              <div className="space-y-1.5">
                {events.map(e => {
                  const d = e.start.dateTime ?? e.start.date ?? ''
                  const dateStr = d ? new Date(d).toLocaleDateString('pl-PL', { month:'short', day:'numeric', weekday:'short' }) : ''
                  const timeStr = e.start.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' }) : ''
                  return (
                    <div key={e.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-lg group">
                      <div className="flex-shrink-0 text-center bg-blue-50 rounded-lg px-2 py-1 min-w-12">
                        <p className="text-xs font-bold text-blue-700">{dateStr}</p>
                        {timeStr && <p className="text-xs text-blue-500">{timeStr}</p>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{e.summary}</p>
                        {e.description && <p className="text-xs text-gray-400 truncate">{e.description}</p>}
                      </div>
                      <button onClick={() => deleteEvent(e.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs px-1">×</button>
                    </div>
                  )
                })}
              </div>
            }
          </div>
        )}

        {/* GMAIL */}
        {tab === 'gmail' && (
          <div className="p-3">
            <p className="text-xs text-gray-500 mb-3">Maile przetargowe (przetarg, oferta, ORLEN, LPG):</p>
            {loading ? <p className="text-xs text-center text-gray-400 py-4">Ładowanie...</p> :
              messages.length === 0 ? <p className="text-xs text-center text-gray-400 py-4">Brak wiadomości</p> :
              <div className="space-y-1.5">
                {messages.map(m => (
                  <div key={m.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-400 font-mono">{m.id.substring(0,8)}...</span>
                    <a href={`https://mail.google.com/mail/u/0/#inbox/${m.threadId}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline">Otwórz w Gmail ↗</a>
                  </div>
                ))}
              </div>
            }
          </div>
        )}
      </div>
    </div>
  )
}
