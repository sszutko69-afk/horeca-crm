'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

// ================================================================
// TAŁA PULPITU — 10 motywów
// ================================================================
const TLA = [
  { id: 'biale',       nazwa: 'Klasyczna biel',    opis: 'Czysty, profesjonalny styl',         preview: 'bg-gray-50', style: { background: '#f9fafb' } },
  { id: 'nocne_niebo', nazwa: 'Nocne niebo',        opis: 'Granatowy gradient',                  preview: 'bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950', style: { background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e1b4b 100%)' } },
  { id: 'las',         nazwa: 'Leśna głębia',       opis: 'Zielony spokój natury',               preview: 'bg-gradient-to-br from-emerald-950 via-green-900 to-teal-900', style: { background: 'linear-gradient(135deg, #064e3b 0%, #14532d 50%, #134e4a 100%)' } },
  { id: 'zachod',      nazwa: 'Zachód słońca',      opis: 'Ciepłe barwy wieczoru',               preview: 'bg-gradient-to-br from-orange-950 via-rose-900 to-pink-950', style: { background: 'linear-gradient(135deg, #431407 0%, #881337 50%, #4a044e 100%)' } },
  { id: 'arktyk',      nazwa: 'Arktyczny błękit',   opis: 'Lodowata klarowność',                 preview: 'bg-gradient-to-br from-sky-100 via-blue-200 to-indigo-200', style: { background: 'linear-gradient(135deg, #e0f2fe 0%, #bfdbfe 50%, #c7d2fe 100%)' } },
  { id: 'industria',   nazwa: 'Industrialny grafit', opis: 'Ciemny, skupiony, profesjonalny',    preview: 'bg-gradient-to-br from-gray-900 via-zinc-800 to-stone-900', style: { background: 'linear-gradient(135deg, #111827 0%, #27272a 50%, #1c1917 100%)' } },
  { id: 'fiolet',      nazwa: 'Królewska purpura',  opis: 'Elegancja i władza',                  preview: 'bg-gradient-to-br from-violet-950 via-purple-900 to-fuchsia-950', style: { background: 'linear-gradient(135deg, #2e1065 0%, #4a1d96 50%, #4a044e 100%)' } },
  { id: 'zloto',       nazwa: 'Złota jesień',       opis: 'Ciepłe złoto i brąz',                 preview: 'bg-gradient-to-br from-amber-100 via-yellow-200 to-orange-200', style: { background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fed7aa 100%)' } },
  { id: 'morze',       nazwa: 'Głębiny oceanu',     opis: 'Spokojne fale i cisza',               preview: 'bg-gradient-to-br from-cyan-950 via-teal-900 to-sky-950', style: { background: 'linear-gradient(135deg, #083344 0%, #134e4a 50%, #082f49 100%)' } },
  { id: 'zielen_miejska', nazwa: 'Miejska zieleń',  opis: 'Świeżość w centrum miasta',           preview: 'bg-gradient-to-br from-lime-100 via-green-200 to-emerald-200', style: { background: 'linear-gradient(135deg, #ecfccb 0%, #bbf7d0 50%, #a7f3d0 100%)' } },
]

// ================================================================
// MODUŁY HORECA
// ================================================================
const WSZYSTKIE_MODULY = [
  { nazwa: 'Klienci',         href: '/klienci',     ikona: '👥', role: ['admin','menedzer'],                       opis: 'Baza klientów i firm' },
  { nazwa: 'Rezerwacje',      href: '/rezerwacje',  ikona: '📅', role: ['admin','menedzer','kelner'],              opis: 'Zarządzanie stolikami' },
  { nazwa: 'Stoły',           href: '/stoly',       ikona: '🪑', role: ['admin','menedzer','kelner'],              opis: 'Plan sali i statusy' },
  { nazwa: 'Menu',            href: '/menu',        ikona: '🍽️', role: ['admin','menedzer','kucharz'],             opis: 'Karta dań i napojów' },
  { nazwa: 'Sprzedaż',        href: '/sprzedaz',    ikona: '💰', role: ['admin','menedzer'],                       opis: 'Faktury i sprzedaż' },
  { nazwa: 'Zakupy',          href: '/zakupy',      ikona: '📦', role: ['admin','menedzer'],                       opis: 'Zakupy i dostawy' },
  { nazwa: 'POS',             href: '/pos',         ikona: '🖥️', role: ['admin','menedzer'],                       opis: 'System kasowy POS' },
  { nazwa: 'eService',        href: '/eservice',    ikona: '💳', role: ['admin','menedzer'],                       opis: 'Terminale płatnicze' },
  { nazwa: 'Bank',            href: '/bank',        ikona: '🏦', role: ['admin'],                                  opis: 'Wyciągi bankowe' },
  { nazwa: 'Raporty',         href: '/raporty',     ikona: '📊', role: ['admin','menedzer'],                       opis: 'Analityka i raporty' },
  { nazwa: 'CRM',             href: '/crm',         ikona: '🤝', role: ['admin','menedzer'],                       opis: 'Relacje z klientami' },
  { nazwa: 'Budżet',          href: '/budzet',      ikona: '📈', role: ['admin'],                                  opis: 'Plan i realizacja' },
  { nazwa: 'AI — Finanse',    href: '/ai',          ikona: '🤖', role: ['admin','menedzer'],                       opis: 'Analiza AI' },
  { nazwa: 'Kadry',           href: '/kadry',       ikona: '👷', role: ['admin','menedzer'],                       opis: 'Zarządzanie personelem' },
  { nazwa: 'Czas pracy',      href: '/czasPracy',   ikona: '⏱️', role: ['admin','menedzer'],                       opis: 'Ewidencja czasu' },
  { nazwa: 'Plan pracy',      href: '/planpracy',   ikona: '📋', role: ['admin','menedzer'],                       opis: 'Grafik pracowników' },
  { nazwa: 'Płace',           href: '/place',       ikona: '💵', role: ['admin'],                                  opis: 'Lista płac' },
  { nazwa: 'Użytkownicy',     href: '/uzytkownicy', ikona: '🔐', role: ['admin'],                                  opis: 'Zarządzanie dostępem' },
  { nazwa: 'Dane firmy',      href: '/ustawienia',  ikona: '⚙️', role: ['admin'],                                  opis: 'Ustawienia firmy' },
  { nazwa: 'Google Workspace',href: '/google',      ikona: '📧', role: ['admin','menedzer'],                       opis: 'Gmail, Drive, Calendar' },
  { nazwa: 'inFakt',          href: '/infakt',      ikona: '🧾', role: ['admin'],                                  opis: 'Faktury inFakt' },
  { nazwa: 'Import danych',   href: '/import',      ikona: '📥', role: ['admin'],                                  opis: 'Import Excel/CSV' },
]

const DOMYSLNE = ['Rezerwacje', 'Stoły', 'Menu', 'POS', 'eService', 'Bank']

const SZYBKIE_AKCJE_WSZYSTKIE = [
  { label: '+ Nowa rezerwacja',  href: '/rezerwacje',  role: ['admin','menedzer','kelner'] },
  { label: '📋 Plan pracy',      href: '/planpracy',   role: ['admin','menedzer'] },
  { label: '+ Nowy klient',      href: '/klienci',     role: ['admin','menedzer'] },
  { label: '+ Nowa faktura',     href: '/sprzedaz',    role: ['admin','menedzer'] },
  { label: '+ Nowy zakup',       href: '/zakupy',      role: ['admin','menedzer'] },
  { label: 'Raport dzienny',     href: '/raporty',     role: ['admin','menedzer'] },
  { label: 'Terminale',          href: '/eservice',    role: ['admin','menedzer'] },
  { label: 'Wyciąg bankowy',     href: '/bank',        role: ['admin'] },
  { label: 'Import Excel',       href: '/import',      role: ['admin'] },
  { label: 'inFakt faktury',     href: '/infakt',      role: ['admin'] },
]

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { maximumFractionDigits: 0 }) + ' zł'
}

export default function DashboardPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [rola, setRola] = useState<string | null>(null)
  const [imie, setImie] = useState('')
  const [loading, setLoading] = useState(true)

  const [edycja, setEdycja] = useState(false)
  const [edycjaTla, setEdycjaTla] = useState(false)
  const [widoczne, setWidoczne] = useState<string[]>(DOMYSLNE)
  const [szybkieAkcje, setSzybkieAkcje] = useState<string[]>([])
  const [tloId, setTloId] = useState('biale')

  const [stats, setStats] = useState({
    klienci: 0, sprzedaz: 0, sprzedaz_brutto: 0, zakupy: 0, zakupy_brutto: 0, marza: 0,
  })

  const tlo = TLA.find(t => t.id === tloId) ?? TLA[0]
  const isDark = ['nocne_niebo','las','zachod','industria','fiolet','morze'].includes(tloId)

  useEffect(() => {
    try {
      const zapisane = localStorage.getItem('horekacrm_dashboard_widoczne')
      if (zapisane) setWidoczne(JSON.parse(zapisane))
      const zapisaneSA = localStorage.getItem('horekacrm_dashboard_szybkie')
      if (zapisaneSA) setSzybkieAkcje(JSON.parse(zapisaneSA))
      const zapisaneTlo = localStorage.getItem('horekacrm_dashboard_tlo')
      if (zapisaneTlo) setTloId(zapisaneTlo)
    } catch {}
    load()
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) setEmail(user.email)
    const { data: profile } = await supabase
      .from('profiles')
      .select('rola, imie_nazwisko')
      .eq('id', user?.id ?? '')
      .single()
    if (profile) {
      setRola(profile.rola ?? 'kelner')
      setImie(profile.imie_nazwisko ?? '')
    }

    const [
      { count: kl }, { count: sp }, { count: zk },
      { data: sprzedazData }, { data: zakupyData },
    ] = await Promise.all([
      supabase.from('klienci').select('*', { count: 'exact', head: true }).eq('aktywny', true),
      supabase.from('sprzedaz').select('*', { count: 'exact', head: true }),
      supabase.from('zakupy').select('*', { count: 'exact', head: true }),
      supabase.from('sprzedaz').select('kwota_brutto').limit(1000),
      supabase.from('zakupy').select('wartosc_brutto').limit(1000),
    ])

    const sprzBrutto = (sprzedazData ?? []).reduce((a: number, s: any) => a + (s.kwota_brutto ?? 0), 0)
    const zakBrutto  = (zakupyData  ?? []).reduce((a: number, z: any) => a + (z.wartosc_brutto ?? 0), 0)

    setStats({
      klienci: kl ?? 0, sprzedaz: sp ?? 0, zakupy: zk ?? 0,
      sprzedaz_brutto: sprzBrutto, zakupy_brutto: zakBrutto, marza: sprzBrutto - zakBrutto,
    })
    setLoading(false)
  }

  function statVal(nazwa: string) {
    if (nazwa === 'Klienci')  return { v: stats.klienci + ' aktywnych', s: undefined }
    if (nazwa === 'Sprzedaż') return { v: fmt(stats.sprzedaz_brutto),   s: stats.sprzedaz + ' faktur' }
    if (nazwa === 'Zakupy')   return { v: stats.zakupy + ' dostaw',      s: undefined }
    return null
  }

  function zapiszKonfig(nowe: string[]) {
    setWidoczne(nowe)
    localStorage.setItem('horekacrm_dashboard_widoczne', JSON.stringify(nowe))
  }
  function toggleModul(nazwa: string) {
    zapiszKonfig(widoczne.includes(nazwa) ? widoczne.filter(w => w !== nazwa) : [...widoczne, nazwa])
  }
  function toggleSzybka(label: string) {
    const nowe = szybkieAkcje.includes(label) ? szybkieAkcje.filter(s => s !== label) : [...szybkieAkcje, label]
    setSzybkieAkcje(nowe)
    localStorage.setItem('horekacrm_dashboard_szybkie', JSON.stringify(nowe))
  }
  function zmienTlo(id: string) {
    setTloId(id)
    localStorage.setItem('horekacrm_dashboard_tlo', id)
    window.dispatchEvent(new StorageEvent('storage', { key: 'horekacrm_dashboard_tlo', newValue: id }))
    const TLA_BG: Record<string, string> = {
      biale:'#f9fafb', nocne_niebo:'linear-gradient(135deg,#0f172a,#1e3a5f,#1e1b4b)',
      las:'linear-gradient(135deg,#064e3b,#14532d,#134e4a)', zachod:'linear-gradient(135deg,#431407,#881337,#4a044e)',
      arktyk:'linear-gradient(135deg,#e0f2fe,#bfdbfe,#c7d2fe)', industria:'linear-gradient(135deg,#111827,#27272a,#1c1917)',
      fiolet:'linear-gradient(135deg,#2e1065,#4a1d96,#4a044e)', zloto:'linear-gradient(135deg,#fef3c7,#fde68a,#fed7aa)',
      morze:'linear-gradient(135deg,#083344,#134e4a,#082f49)', zielen_miejska:'linear-gradient(135deg,#ecfccb,#bbf7d0,#a7f3d0)',
    }
    document.body.style.background = TLA_BG[id] || '#f9fafb'
    document.body.style.backgroundAttachment = 'fixed'
  }

  const dostepne = rola ? WSZYSTKIE_MODULY.filter(m => m.role.includes(rola)) : WSZYSTKIE_MODULY
  const modulyNaDashboard = dostepne.filter(m => widoczne.includes(m.nazwa))
  const dostepneSA = SZYBKIE_AKCJE_WSZYSTKIE.filter(a => !rola || a.role.includes(rola))
  const szybkieNaDashboard = szybkieAkcje.length > 0
    ? dostepneSA.filter(a => szybkieAkcje.includes(a.label))
    : dostepneSA

  const poraDoby = () => {
    const h = new Date().getHours()
    if (h < 6)  return 'Dobranoc'
    if (h < 12) return 'Dzień dobry'
    if (h < 18) return 'Dobre popołudnie'
    return 'Dobry wieczór'
  }

  const roleNazwa: Record<string, string> = {
    admin: 'Administrator', menedzer: 'Menedżer', kelner: 'Kelner', kucharz: 'Kucharz',
  }

  const cardCls     = isDark ? 'bg-white/10 border border-white/20 backdrop-blur-sm text-white' : 'bg-white border border-gray-200'
  const cardHover   = isDark ? 'hover:bg-white/20' : 'hover:border-gray-300 hover:shadow-sm'
  const textPrimary = isDark ? 'text-white' : 'text-gray-900'
  const textSecondary = isDark ? 'text-white/60' : 'text-gray-500'
  const textMuted   = isDark ? 'text-white/40' : 'text-gray-400'
  const btnCls      = isDark ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
  const panelCls    = isDark ? 'bg-white/10 border border-white/20 backdrop-blur-sm' : 'bg-white border border-gray-200'

  return (
    <div className="min-h-screen transition-all duration-500" style={tlo.style}>
      <div className="p-6 max-w-5xl mx-auto">

        {/* ── Nagłówek ── */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className={`text-2xl font-medium ${textPrimary}`}>
              {poraDoby()}{imie ? `, ${imie.split(' ')[0]}` : ''}!
            </h1>
            <p className={`text-sm mt-1 ${textSecondary}`}>
              {email}
              {rola && (
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {roleNazwa[rola] ?? rola}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setEdycjaTla(v => !v); setEdycja(false) }}
              className={`text-xs border rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5 ${
                edycjaTla
                  ? (isDark ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 text-white border-gray-900')
                  : btnCls
              }`}
            >
              🎨 Tło
            </button>
            <button
              onClick={() => { setEdycja(v => !v); setEdycjaTla(false) }}
              className={`text-xs border rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5 ${
                edycja
                  ? (isDark ? 'bg-white text-gray-900 border-white' : 'bg-gray-900 text-white border-gray-900')
                  : btnCls
              }`}
            >
              {edycja ? '✓ Zapisz układ' : '⚙ Personalizuj'}
            </button>
          </div>
        </div>

        {/* ── Panel wyboru tła ── */}
        {edycjaTla && (
          <div className={`rounded-2xl p-5 mb-6 ${isDark ? 'bg-white/10 border border-white/20 backdrop-blur-sm' : 'bg-white border border-gray-200'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-4 ${isDark ? 'text-white/70' : 'text-gray-500'}`}>
              🎨 Wybierz motyw pulpitu
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {TLA.map(t => (
                <button key={t.id} onClick={() => zmienTlo(t.id)}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all group ${
                    tloId === t.id
                      ? 'border-blue-500 shadow-lg scale-105'
                      : isDark ? 'border-white/20 hover:border-white/50' : 'border-gray-200 hover:border-gray-400'
                  }`}>
                  <div className={`h-12 ${t.preview}`} />
                  <div className={`p-2 ${isDark ? 'bg-white/10' : 'bg-white'}`}>
                    <p className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.nazwa}</p>
                    <p className={`text-xs truncate ${isDark ? 'text-white/50' : 'text-gray-400'}`}>{t.opis}</p>
                  </div>
                  {tloId === t.id && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Panel personalizacji ── */}
        {edycja && (
          <div className={`rounded-2xl p-5 mb-6 ${isDark ? 'bg-white/10 border border-white/20 backdrop-blur-sm' : 'bg-blue-50 border border-blue-200'}`}>
            <div className="space-y-4">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-white/70' : 'text-blue-800'}`}>
                  📦 Kafelki na dashboardzie
                </p>
                <div className="flex flex-wrap gap-2">
                  {dostepne.map(m => (
                    <button key={m.nazwa} onClick={() => toggleModul(m.nazwa)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                        widoczne.includes(m.nazwa)
                          ? (isDark ? 'bg-white text-gray-900 border-white' : 'bg-blue-600 text-white border-blue-600')
                          : (isDark ? 'bg-white/10 text-white border-white/20 hover:bg-white/20' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')
                      }`}>
                      {m.ikona} {m.nazwa}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => zapiszKonfig(DOMYSLNE.filter(n => dostepne.some(m => m.nazwa === n)))}
                  className={`text-xs mt-2 ${isDark ? 'text-white/50 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
                >
                  ↺ Przywróć domyślne kafelki
                </button>
              </div>
              <div className={`border-t pt-4 ${isDark ? 'border-white/20' : 'border-blue-200'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-white/70' : 'text-blue-800'}`}>
                  ⚡ Szybkie akcje
                </p>
                <div className="flex flex-wrap gap-2">
                  {dostepneSA.map(a => (
                    <button key={a.label} onClick={() => toggleSzybka(a.label)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        (szybkieAkcje.length === 0 || szybkieAkcje.includes(a.label))
                          ? (isDark ? 'bg-white text-gray-900 border-white' : 'bg-blue-600 text-white border-blue-600')
                          : (isDark ? 'bg-white/10 text-white border-white/20 hover:bg-white/20' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')
                      }`}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── KPI Banner — tylko gdy są dane ── */}
        {!loading && stats.sprzedaz_brutto > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { l: 'Przychód brutto', v: fmt(stats.sprzedaz_brutto), bg: 'bg-blue-600',  sub: 'text-blue-200' },
              { l: 'Koszty zakupów',  v: fmt(stats.zakupy_brutto),  bg: isDark ? 'bg-white/20' : 'bg-gray-800', sub: isDark ? 'text-white/60' : 'text-gray-400' },
              { l: 'Marża brutto',    v: fmt(stats.marza), bg: stats.marza >= 0 ? 'bg-green-600' : 'bg-red-600', sub: stats.marza >= 0 ? 'text-green-200' : 'text-red-200' },
            ].map(k => (
              <div key={k.l} className={`rounded-xl p-4 text-white ${k.bg}`}>
                <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${k.sub}`}>{k.l}</p>
                <p className="text-xl font-semibold">{k.v}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Kafelki modułów ── */}
        {modulyNaDashboard.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 mb-6">
            {modulyNaDashboard.map(m => {
              const sv = statVal(m.nazwa)
              return (
                <a key={m.nazwa} href={m.href}
                  className={`rounded-xl p-5 transition-all group ${cardCls} ${cardHover}`}>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">{m.ikona}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      className={`${textMuted} group-hover:translate-x-0.5 transition-transform mt-0.5`}>
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </div>
                  <p className={`text-sm font-semibold mb-0.5 ${textPrimary}`}>{m.nazwa}</p>
                  <p className={`text-xs mb-1 ${textSecondary}`}>{m.opis}</p>
                  {sv ? (
                    <>
                      <p className={`text-base font-medium ${textPrimary}`}>{sv.v}</p>
                      {sv.s && <p className={`text-xs ${textMuted}`}>{sv.s}</p>}
                    </>
                  ) : (
                    <p className={`text-xs ${textMuted}`}>{loading ? '...' : 'kliknij aby otworzyć'}</p>
                  )}
                </a>
              )
            })}
          </div>
        ) : (
          <div className={`rounded-xl p-8 text-center mb-6 ${panelCls}`}>
            <p className={`text-sm ${textSecondary}`}>
              Brak kafelków — kliknij <strong>⚙ Personalizuj</strong> aby wybrać moduły
            </p>
          </div>
        )}

        {/* ── Dolna sekcja ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className={`rounded-xl p-5 ${panelCls}`}>
            <h2 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${textPrimary}`}>
              ⚡ Szybkie akcje
            </h2>
            <div className="flex flex-wrap gap-2">
              {szybkieNaDashboard.map(a => (
                <a key={a.label} href={a.href}
                  className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${
                    isDark
                      ? 'border-white/20 text-white hover:bg-white/20'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                  }`}>
                  {a.label}
                </a>
              ))}
            </div>
          </div>

          <div className={`rounded-xl p-5 ${isDark ? 'bg-white/10 border border-white/20' : 'bg-blue-50 border border-blue-100'}`}>
            <h2 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-blue-900'}`}>
              🟢 Status systemu
            </h2>
            <div className="space-y-1.5">
              {[
                { label: 'Baza danych Supabase',  ok: true },
                { label: 'Rezerwacje i stoły',     ok: true },
                { label: 'Sprzedaż i zakupy',      ok: true },
                { label: 'POS — synchronizacja',   ok: true },
                { label: 'eService — terminale',   ok: true },
                { label: 'Bank API',               ok: true },
                { label: 'Raporty i analityka',    ok: true },
                ...(rola === 'admin' ? [
                  { label: 'Integracja inFakt',    ok: true },
                  { label: 'Google Workspace',     ok: true },
                ] : []),
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-500" />
                  <span className={isDark ? 'text-white/80' : 'text-blue-800'}>{s.label}</span>
                  <span className="ml-auto text-green-500 font-medium">OK</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`mt-4 text-center text-xs ${textMuted}`}>
          Motyw: <span className={`font-medium ${textSecondary}`}>{tlo.nazwa}</span>
          {' · '}
          <button onClick={() => setEdycjaTla(true)} className={`hover:underline ${isDark ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
            zmień
          </button>
        </div>
      </div>
    </div>
  )
}
