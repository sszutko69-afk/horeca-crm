'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function DashboardPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [stats, setStats] = useState({ klienci: 0, zakupy: 0, sprzedaz: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setEmail(user.email)
      const [{ count: kl }, { count: zk }, { count: sp }] = await Promise.all([
        supabase.from('klienci').select('*', { count: 'exact', head: true }).eq('aktywny', true),
        supabase.from('zakupy').select('*', { count: 'exact', head: true }),
        supabase.from('sprzedaz').select('*', { count: 'exact', head: true }),
      ])
      setStats({ klienci: kl ?? 0, zakupy: zk ?? 0, sprzedaz: sp ?? 0 })
      setLoading(false)
    }
    load()
  }, [])

  const moduły = [
    { nazwa: 'Klienci', href: '/klienci', opis: 'Baza klientów CRM', val: stats.klienci, suffix: 'aktywnych', color: 'bg-blue-50 text-blue-700' },
    { nazwa: 'Zakupy gazu', href: '/zakupy', opis: 'Ewidencja partii EDD', val: stats.zakupy, suffix: 'partii', color: 'bg-purple-50 text-purple-700' },
    { nazwa: 'Sprzedaż', href: '/sprzedaz', opis: 'Transakcje sprzedaży', val: stats.sprzedaz, suffix: 'transakcji', color: 'bg-green-50 text-green-700' },
    { nazwa: 'Raporty', href: '/raporty', opis: 'Analityka i zestawienia', val: null, suffix: '', color: 'bg-amber-50 text-amber-700' },
    { nazwa: 'Cysterna & GPS', href: '/cysterna', opis: 'Trasy i lokalizacja', val: null, suffix: '', color: 'bg-teal-50 text-teal-700' },
    { nazwa: 'Inwestycje', href: '/inwestycje', opis: 'Projekty budowlane', val: null, suffix: '', color: 'bg-rose-50 text-rose-700' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">Dzień dobry!</h1>
        <p className="text-sm text-gray-500 mt-1">{email} · GazCRM</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {moduły.map(m => (
          <a key={m.nazwa} href={m.href}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all group">
            <div className="flex items-start justify-between mb-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.color}`}>{m.nazwa}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-300 group-hover:text-gray-400 transition-colors mt-0.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
            {!loading && m.val !== null ? (
              <p className="text-3xl font-medium text-gray-900 mb-1">{m.val}</p>
            ) : (
              <p className="text-3xl font-medium text-gray-200 mb-1">—</p>
            )}
            <p className="text-xs text-gray-400">{m.val !== null ? m.suffix : m.opis}</p>
          </a>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Szybkie akcje</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '+ Nowy klient', href: '/klienci' },
              { label: '+ Zakup gazu', href: '/zakupy' },
              { label: '+ Sprzedaż', href: '/sprzedaz' },
              { label: 'Raport dobowy', href: '/raporty' },
            ].map(a => (
              <a key={a.label} href={a.href}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">
                {a.label}
              </a>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <h2 className="text-sm font-medium text-blue-900 mb-1">Status systemu</h2>
          <div className="space-y-1.5 mt-2">
            {[
              { label: 'Baza danych Supabase', ok: true },
              { label: 'Moduł zakupów', ok: true },
              { label: 'Moduł sprzedaży', ok: true },
              { label: 'Raporty', ok: true },
              { label: 'GPS & Cysterna', ok: false },
              { label: 'Integracja inFakt', ok: false },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.ok ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                <span className={s.ok ? 'text-blue-800' : 'text-blue-400'}>{s.label}</span>
                <span className={`ml-auto text-xs ${s.ok ? 'text-green-600' : 'text-gray-400'}`}>{s.ok ? 'OK' : 'wkrótce'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
