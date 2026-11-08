'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'

type Komentarz = {
  id: string; modul: string; rekord_id: string | null
  autor_nazwa: string; tresc: string; przypiety: boolean; created_at: string
}
type Props = {
  modul: string; rekordId?: string; rekordTytul?: string; compact?: boolean
}

const IKONY: Record<string, string> = {
  przetargi: '📋', inwestycje: '🏗', klienci: '👥',
  trasy: '🚚', raporty: '📊', zakupy: '📦', sprzedaz: '💰', ogolny: '💬',
}

export default function CzatPanel({ modul, rekordId, rekordTytul, compact = false }: Props) {
  const supabase = createClient()
  const [komentarze, setKomentarze] = useState<Komentarz[]>([])
  const [loading, setLoading] = useState(true)
  const [tresc, setTresc] = useState('')
  const [saving, setSaving] = useState(false)
  const [autorNazwa, setAutorNazwa] = useState('')
  const [autorId, setAutorId] = useState<string | null>(null)
  const [open, setOpen] = useState(!compact)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchAutor()
  }, [])

  useEffect(() => {
    if (autorId) fetchKomentarze()
  }, [modul, rekordId, autorId])

  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [komentarze, open])

  async function fetchAutor() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setAutorId(user.id)
    const { data } = await supabase.from('profiles').select('imie_nazwisko').eq('id', user.id).single()
    setAutorNazwa(data?.imie_nazwisko ?? user.email ?? 'Użytkownik')
  }

  async function fetchKomentarze() {
    setLoading(true)
    let query = supabase
      .from('komentarze')
      .select('*')
      .eq('modul', modul)
      .order('created_at', { ascending: true })

    if (rekordId) {
      query = query.eq('rekord_id', rekordId)
    } else {
      query = query.is('rekord_id', null)
    }

    const { data, error: err } = await query
    if (err) console.error('[CzatPanel] fetch error:', err.message)
    if (data) setKomentarze(data)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const tekst = tresc.trim()
    if (!tekst || !autorNazwa) return
    setSaving(true); setError('')

    const payload: any = {
      modul,
      rekord_id: rekordId ?? null,
      rekord_tytul: rekordTytul ?? null,
      autor_id: autorId,
      autor_nazwa: autorNazwa,
      tresc: tekst,
    }

    const { data, error: err } = await supabase
      .from('komentarze')
      .insert(payload)
      .select()
      .single()

    if (err) {
      setError('Błąd: ' + err.message)
      console.error('[CzatPanel] insert error:', err)
    } else if (data) {
      // Dodaj lokalnie — nie czekaj na realtime
      setKomentarze(prev => [...prev, data])
      setTresc('')
    }
    setSaving(false)
  }

  async function togglePrzypiety(k: Komentarz) {
    const { error: err } = await supabase.from('komentarze').update({ przypiety: !k.przypiety }).eq('id', k.id)
    if (!err) setKomentarze(prev => prev.map(x => x.id === k.id ? { ...x, przypiety: !x.przypiety } : x))
  }

  async function usunKomentarz(id: string) {
    const { error: err } = await supabase.from('komentarze').delete().eq('id', id)
    if (!err) setKomentarze(prev => prev.filter(x => x.id !== id))
  }

  function formatData(d: string) {
    const dt = new Date(d)
    const dzis = new Date()
    if (dt.toDateString() === dzis.toDateString())
      return `Dziś ${dt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
    return dt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  function initials(name: string) {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  }

  const pinned = komentarze.filter(k => k.przypiety)
  const reszta = komentarze.filter(k => !k.przypiety)
  const ikona = IKONY[modul] ?? '💬'

  // ── Floating button ──────────────────────────────────────────────────────
  if (compact && !open) {
    return (
      <button onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-xl hover:bg-gray-700 transition-all flex items-center gap-2 z-50">
        <span className="text-lg">{ikona}</span>
        <span className="text-sm font-medium">Czat</span>
        {komentarze.length > 0 && (
          <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {komentarze.length}
          </span>
        )}
      </button>
    )
  }

  // ── Panel ─────────────────────────────────────────────────────────────────
  const wrapCls = compact
    ? 'fixed bottom-0 right-0 w-80 h-[520px] bg-white border border-gray-200 rounded-tl-2xl shadow-2xl flex flex-col z-50'
    : 'bg-white border border-gray-200 rounded-xl flex flex-col'
  const bodyCls = compact
    ? 'flex-1 overflow-y-auto px-3 py-2'
    : 'flex-1 overflow-y-auto px-4 py-3 max-h-96'

  return (
    <div className={wrapCls}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span>{ikona}</span>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {rekordTytul ? rekordTytul.slice(0, 28) + (rekordTytul.length > 28 ? '…' : '') : `Czat · ${modul}`}
            </p>
            <p className="text-xs text-gray-400">{komentarze.length} wiadomości</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchKomentarze} className="text-gray-400 hover:text-gray-600 text-sm" title="Odśwież">↻</button>
          {compact && <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>}
        </div>
      </div>

      {/* Przypięte */}
      {pinned.length > 0 && (
        <div className="bg-yellow-50 border-b border-yellow-100 px-3 py-2 flex-shrink-0">
          {pinned.map(k => (
            <div key={k.id} className="flex items-start gap-2">
              <span className="text-xs text-yellow-600 flex-shrink-0">📌</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-yellow-800">{k.autor_nazwa}</p>
                <p className="text-xs text-yellow-700 truncate">{k.tresc}</p>
              </div>
              <button onClick={() => togglePrzypiety(k)} className="text-yellow-400 hover:text-yellow-600 text-xs flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Wiadomości */}
      <div className={bodyCls}>
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-4">Ładowanie...</p>
        ) : reszta.length === 0 && pinned.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">{ikona}</p>
            <p className="text-xs text-gray-400">Brak wiadomości. Napisz pierwszy!</p>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            {reszta.map(k => {
              const isMe = k.autor_nazwa === autorNazwa
              return (
                <div key={k.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isMe ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                    {initials(k.autor_nazwa)}
                  </div>
                  <div className="max-w-[75%] group">
                    <div className={`rounded-2xl px-3 py-2 ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                      {!isMe && <p className="text-xs font-medium text-gray-500 mb-0.5">{k.autor_nazwa}</p>}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{k.tresc}</p>
                    </div>
                    <div className={`flex items-center gap-2 mt-0.5 ${isMe ? 'justify-end' : ''}`}>
                      <span className="text-xs text-gray-400">{formatData(k.created_at)}</span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button onClick={() => togglePrzypiety(k)} title="Przypnij" className="text-xs text-gray-400 hover:text-yellow-500">📌</button>
                        <button onClick={() => usunKomentarz(k.id)} title="Usuń" className="text-xs text-gray-400 hover:text-red-500">🗑</button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-3 py-3 flex-shrink-0">
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        {!autorNazwa && <p className="text-xs text-amber-600 mb-2">⚠ Ładowanie danych użytkownika...</p>}
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            ref={textRef}
            value={tresc}
            onChange={e => setTresc(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e as any)
              }
            }}
            placeholder="Wpisz wiadomość... (Enter = wyślij)"
            rows={2}
            disabled={!autorNazwa}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
          />
          <button type="submit" disabled={saving || !tresc.trim() || !autorNazwa}
            className="bg-blue-600 text-white rounded-xl px-3 py-2 hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
