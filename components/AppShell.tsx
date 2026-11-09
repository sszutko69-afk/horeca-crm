'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import GazekAssistant from './GazekAssistant'
import MalaAssistant  from './MalaAssistant'

// Maskotki (Chef / Mala) wyłączone w demo — ustaw true, aby włączyć dla klienta
const MASCOTS_ENABLED = false

// ================================================================
// NAWIGACJA — HoReCa CRM
// ================================================================
const nav = [
  { group: 'Główne', items: [
    { href: '/dashboard',   label: 'Dashboard',   modul: 'Dashboard',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/akceptacje',  label: 'Akceptacje',  modul: 'Akceptacje',  icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  ]},
  { group: 'Restauracja', items: [
    { href: '/rezerwacje',  label: 'Rezerwacje',  modul: 'Rezerwacje',  icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { href: '/stoly',       label: 'Stoły',       modul: 'Stoły',       icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
    { href: '/menu',        label: 'Menu & Dania', modul: 'Menu',       icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  ]},
  { group: 'Sprzedaż & Zakupy', items: [
    { href: '/crm',         label: 'CRM',         modul: 'CRM',         icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { href: '/leady',       label: 'Leady',       modul: 'Leady',       icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { href: '/klienci',     label: 'Klienci',     modul: 'Klienci',     icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { href: '/zamowienia',  label: 'Zamówienia',  modul: 'Zamówienia',  icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
    { href: '/zakupy',      label: 'Zakupy',      modul: 'Zakupy',      icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
    { href: '/sprzedaz',    label: 'Sprzedaż',    modul: 'Sprzedaż',    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ]},
  { group: 'Analityka', items: [
    { href: '/raporty',     label: 'Raporty',     modul: 'Raporty',     icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { href: '/ai',          label: 'AI — Finanse', modul: 'AI — Finanse', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    { href: '/budzet',      label: 'Budżet',      modul: 'Budżet',      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ]},
  { group: 'Integracje', items: [
    { href: '/pos',         label: 'POS',         modul: 'POS',         icon: 'M9 7H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-2M9 7a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { href: '/eservice',    label: 'eService',    modul: 'eService',    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { href: '/bank',        label: 'Bank',        modul: 'Bank',        icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z' },
    { href: '/google',      label: 'Google Workspace', modul: 'Google Workspace', icon: 'M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.93 4.9 1.93l2.05-2.05C18.37 3.68 15.76 2.5 12.2 2.5 6.42 2.5 2.03 7 2.03 12s4.39 9.5 10.17 9.5c5.56 0 9.63-3.88 9.63-9.5 0-.69-.07-1.27-.18-1.9h.7z' },
  ]},
  { group: 'Kadry', items: [
    { href: '/kadry',       label: 'Pracownicy',  modul: 'Kadry',       icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { href: '/czasPracy',   label: 'Czas pracy',  modul: 'Czas pracy',  icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { href: '/planpracy',   label: 'Plan pracy',  modul: 'Plan pracy',  icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { href: '/place',       label: 'Płace',       modul: 'Płace',       icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  ]},
  { group: 'System', items: [
    { href: '/infakt',      label: 'Księgowość',    modul: 'inFakt',        icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5' },
    { href: '/import',      label: 'Import danych', modul: 'Import danych', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
    { href: '/backup',      label: 'Archiwizacja',  modul: 'Archiwizacja',  icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
    { href: '/uzytkownicy', label: 'Użytkownicy',   modul: 'Użytkownicy',   icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { href: '/ustawienia',  label: 'Dane firmy',    modul: 'Dane firmy',    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ]},
]

// ================================================================
// KOLORY MENU BOCZNEGO
// ================================================================
const PALETTE = [
  { id: 'navy',     bg: '#032D60', accent: '#0176D3', name: 'Granat'  },
  { id: 'slate',    bg: '#1B2B3B', accent: '#2E9EEA', name: 'Łupek'   },
  { id: 'forest',   bg: '#1A3C34', accent: '#2EA870', name: 'Las'     },
  { id: 'wine',     bg: '#4A1520', accent: '#E05252', name: 'Burgund'  },
  { id: 'purple',   bg: '#2D1B5C', accent: '#7C5ED4', name: 'Fiolet'  },
  { id: 'midnight', bg: '#0D1117', accent: '#58A6FF', name: 'Nocny'   },
  { id: 'steel',    bg: '#2D3A45', accent: '#4A9EBF', name: 'Stal'    },
  { id: 'olive',    bg: '#2A3020', accent: '#8FBF5A', name: 'Oliwka'  },
]

// ================================================================
// POMOC — opisy modułów HoReCa
// ================================================================
const HELP_MODULES = [
  { icon: '🏠', name: 'Dashboard',         desc: 'Ekran główny z kafelkami skrótów, statystykami i powiadomieniami. Możliwość wyboru motywu tła.' },
  { icon: '✅', name: 'Akceptacje',         desc: 'Kolejka pozycji czekających na decyzję — czas pracy, zamówienia, rezerwacje. Akceptacja, odrzucenie lub odesłanie do poprawy z komentarzem.' },
  { icon: '📅', name: 'Rezerwacje',         desc: 'Zarządzanie rezerwacjami stolików — widok kalendarza, lista gości, statusy, SMS/email potwierdzenia. Integracja z systemem POS.' },
  { icon: '🪑', name: 'Stoły',              desc: 'Plan sali — rozmieszczenie stolików, pojemność, statusy (wolny/zajęty/zarezerwowany). Drag & drop edycja planu.' },
  { icon: '📖', name: 'Menu',               desc: 'Zarządzanie kartą menu — dania, napoje, ceny, alergeny, dostępność. Kategorie i sezonowe wersje menu.' },
  { icon: '📞', name: 'CRM',                desc: 'Zarządzanie zadaniami sprzedażowymi i kontaktami z kontrahentami. Terminy, statusy, przypomnienia.' },
  { icon: '📋', name: 'Leady',              desc: 'Pipeline sprzedaży — potencjalni klienci (hotele, restauracje) od pierwszego kontaktu do realizacji. Kanban, historia rozmów, dokumenty.' },
  { icon: '📦', name: 'Zamówienia',         desc: 'Zamówienia do dostawców i od klientów — z leadów lub ręcznie. Zarządzanie statusami, terminy dostaw.' },
  { icon: '👥', name: 'Klienci',            desc: 'Baza klientów — restauracje, hotele, catering — z danymi kontaktowymi, historią transakcji.' },
  { icon: '🛒', name: 'Zakupy',             desc: 'Rejestrowanie zakupów produktów spożywczych i napojów — ilości, ceny, dostawcy, faktury.' },
  { icon: '📈', name: 'Sprzedaż',           desc: 'Rejestr sprzedaży, faktury, statystyki sprzedaży według produktów i klientów.' },
  { icon: '📊', name: 'Raporty',            desc: 'Raporty sprzedaży, zakupów, frekwencji, aktywności. Eksport do PDF i CSV.' },
  { icon: '🤖', name: 'AI — Finanse',       desc: 'Analityk AI oparty na Claude — analizuje dane finansowe, frekwencję, marże i odpowiada na pytania w języku naturalnym.' },
  { icon: '💰', name: 'Budżet',             desc: 'Planowanie i kontrola budżetu firmy, porównanie planu z wykonaniem.' },
  { icon: '🖥', name: 'POS',                desc: 'Integracja z systemem POS (punkt sprzedaży) — synchronizacja zamówień, paragonów i stanów magazynowych w czasie rzeczywistym.' },
  { icon: '💳', name: 'eService',           desc: 'Integracja z bramką płatniczą eService — obsługa płatności kartą, terminale, rozliczenia, raporty transakcji.' },
  { icon: '🏦', name: 'Bank',               desc: 'Połączenie z rachunkiem bankowym — automatyczne pobieranie wyciągów, dopasowywanie płatności do faktur, kontrola płynności.' },
  { icon: '📧', name: 'Google Workspace',   desc: 'Integracja z Gmail i Kalendarzem Google — odczyt poczty i zdarzeń bez opuszczania CRM.' },
  { icon: '👷', name: 'Kadry',              desc: 'Kartoteka pracowników z danymi kadrowymi, uprawnieniami (np. sanepid), wymiarem etatu, danymi do wypłaty.' },
  { icon: '⏱', name: 'Czas pracy',         desc: 'Miesięczna ewidencja czasu pracy — godziny, urlopy, L4, delegacje, nadgodziny.' },
  { icon: '📅', name: 'Plan pracy',         desc: 'Grafik zmian — planowanie dyżurów kelnerów, kucharzy i obsługi na dany miesiąc.' },
  { icon: '💵', name: 'Płace',              desc: 'Naliczanie wynagrodzeń UoP — ZUS pracownika i pracodawcy, PIT, delegacje, premie. Pasek wynagrodzenia.' },
  { icon: '🧾', name: 'Księgowość',         desc: 'Integracja z inFakt — faktury, przychody, koszty.' },
  { icon: '📥', name: 'Import danych',      desc: 'Import danych z plików CSV/Excel do bazy systemu.' },
  { icon: '💾', name: 'Archiwizacja',       desc: 'Tworzenie kopii zapasowej bazy danych i eksport danych.' },
  { icon: '👤', name: 'Użytkownicy',        desc: 'Zarządzanie kontami użytkowników, rolami i uprawnieniami dostępu do modułów.' },
  { icon: '⚙️', name: 'Dane firmy',         desc: 'Ustawienia firmy — NIP, adres, logo, dane do faktur i dokumentów.' },
]

type Screen = 'mobile' | 'tablet' | 'desktop'

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

// ================================================================
// KOMPONENT GŁÓWNY
// ================================================================
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Rozmiar ekranu
  const [screen, setScreen] = useState<Screen>('desktop')

  // Sidebar
  const [collapsed,   setCollapsed]   = useState(false)  // tylko na desktop
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [showColors,  setShowColors]  = useState(false)
  const [sideColor,   setSideColor]   = useState(PALETTE[0])

  // Topbar
  const [showHelp,    setShowHelp]    = useState(false)
  // Maskotka
  const [mascot, setMascot] = useState<'gazek'|'mala'>(() => {
    if(typeof window === 'undefined') return 'gazek'
    return (localStorage.getItem('horekacrm_mascot') as 'gazek'|'mala') ?? 'gazek'
  })

  // Użytkownik
  const [userEmail,    setUserEmail]    = useState('')
  const [userInitials, setUserInitials] = useState('U')
  const [moduly,       setModuly]       = useState<string[] | null>(null)
  const [nieprzeczytane, setNieprzeczytane] = useState(0)
  const supabaseRef = useRef(createClient())

  // ── Licznik powiadomień ───────────────────────────────────
  // Odświeża się co minutę i po powrocie na kartę, żeby po decyzji
  // w innym oknie dzwonek nie pokazywał nieaktualnej liczby.
  useEffect(() => {
    const supabase = supabaseRef.current
    let zyje = true

    async function policz() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !zyje) return
      const { count } = await supabase
        .from('powiadomienia')
        .select('*', { count: 'exact', head: true })
        .eq('odbiorca_id', user.id)
        .eq('przeczytane', false)
      if (zyje) setNieprzeczytane(count ?? 0)
    }

    policz()
    const t = setInterval(policz, 60000)
    const onFocus = () => policz()
    window.addEventListener('focus', onFocus)
    return () => { zyje = false; clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [])

  // ── Detekcja rozmiaru ekranu ──────────────────────────────
  useEffect(() => {
    function detect() {
      const w = window.innerWidth
      setScreen(w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop')
    }
    detect()
    window.addEventListener('resize', detect)
    return () => window.removeEventListener('resize', detect)
  }, [])

  // Zamknij mobile overlay gdy przejdzie do desktop/tablet
  useEffect(() => { if (!isMobile) setMobileOpen(false) }, [screen])

  // ── Ładowanie z localStorage ──────────────────────────────
  useEffect(() => {
    const c = localStorage.getItem('horekacrm_sidebar_collapsed')
    if (c !== null) setCollapsed(c === 'true')
    const col = localStorage.getItem('horekacrm_sidebar_color')
    if (col) {
      const found = PALETTE.find(p => p.id === col)
      if (found) setSideColor(found)
    }
  }, [])

  // ── Użytkownik + moduły ───────────────────────────────────
  useEffect(() => {
    const supabase = supabaseRef.current
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) return
      setUserEmail(user.email)
      const parts = user.email.split('@')[0].split('.')
      setUserInitials(parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : user.email.slice(0, 2).toUpperCase()
      )
      const { data: profile } = await supabase
        .from('profiles').select('moduly,rola').eq('id', user.id).single()
      if (profile) {
        const domyslne: Record<string, string[]> = {
          admin: ['Dashboard','Akceptacje','Rezerwacje','Stoły','Menu','CRM','Leady','Zamówienia','Klienci','Zakupy','Sprzedaż','Raporty','AI — Finanse','Budżet','POS','eService','Bank','Google Workspace','inFakt','Import danych','Archiwizacja','Użytkownicy','Dane firmy','Kadry','Czas pracy','Plan pracy','Płace'],
          menedzer: ['Dashboard','Akceptacje','Rezerwacje','Stoły','Menu','CRM','Leady','Zamówienia','Klienci','Zakupy','Sprzedaż','Raporty','AI — Finanse','Budżet','POS','eService','Kadry','Czas pracy','Plan pracy','Płace'],
          kelner: ['Dashboard','Akceptacje','Rezerwacje','Stoły'],
          kucharz: ['Dashboard','Akceptacje','Menu','Zamówienia'],
        }
        setModuly(profile.moduly ?? domyslne[profile.rola] ?? ['Dashboard'])
      }
    })
  }, [])

  function toggleCollapsed(val: boolean) {
    setCollapsed(val)
    localStorage.setItem('horekacrm_sidebar_collapsed', String(val))
  }

  function pickColor(c: typeof PALETTE[0]) {
    setSideColor(c)
    localStorage.setItem('horekacrm_sidebar_color', c.id)
    setShowColors(false)
  }

  async function handleLogout() {
    await supabaseRef.current.auth.signOut()
    window.location.href = '/login'
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const navFiltered = nav.map(g => ({
    ...g,
    items: g.items.filter(i => !moduly || moduly.includes(i.modul)),
  })).filter(g => g.items.length > 0)

  const currentLabel = navFiltered.flatMap(g => g.items).find(i => isActive(i.href))?.label ?? 'HoReCa CRM'

  // ── Szerokości i widoczność paska bocznego ─────────────────
  // mobile: wysuwany overlay (224px)
  // tablet: zawsze widoczny, zawsze mini (56px)
  // desktop: pełny (224px) lub mini (56px) wg preferencji
  const isMobile = (screen as string) === 'mobile'
  const isTablet = (screen as string) === 'tablet'
  const isDesktop = (screen as string) === 'desktop'

  const isMini   = isTablet || (isDesktop && collapsed)
  const sideW    = isMini ? 56 : 224
  const marginL  = isMobile ? 0 : sideW

  const sideTranslate = isMobile
    ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)')
    : 'translateX(0)'

  return (
    <div className="flex min-h-screen" style={{ background: '#F3F3F3' }}>

      {/* Mobile overlay tło */}
      {mobileOpen && isMobile && (
        <div className="fixed inset-0 z-30"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMobileOpen(false)} />
      )}

      {/* ════════════════ SIDEBAR ════════════════ */}
      <aside
        style={{
          width: isMobile ? 224 : sideW,
          background: sideColor.bg,
          transform: sideTranslate,
          transition: 'width 180ms ease, transform 220ms ease',
          flexShrink: 0,
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100%',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo */}
        <div style={{
          height: 52, borderBottom: `1px solid rgba(255,255,255,0.1)`,
          display: 'flex', alignItems: 'center',
          padding: isMini && !isMobile ? '0 12px' : '0 16px',
          gap: 10, flexShrink: 0, justifyContent: isMini && !isMobile ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, background: sideColor.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
              <rect x="0" y="0" width="6" height="6" rx="1"/>
              <rect x="10" y="0" width="6" height="6" rx="1"/>
              <rect x="0" y="10" width="6" height="6" rx="1"/>
              <rect x="10" y="10" width="6" height="6" rx="1"/>
            </svg>
          </div>
          {(!isMini || isMobile) && (
            <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              HoReCa CRM
            </span>
          )}
        </div>

        {/* Nawigacja */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {navFiltered.map(group => (
            <div key={group.group} style={{ marginBottom: 2 }}>
              {(!isMini || isMobile) && (
                <p style={{
                  fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.38)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  padding: '6px 16px 2px', margin: 0,
                }}>
                  {group.group}
                </p>
              )}
              {group.items.map(item => {
                const active = isActive(item.href)
                return (
                  <a key={item.href} href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={isMini ? item.label : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: isMini && !isMobile ? '9px 0' : '7px 16px',
                      justifyContent: isMini && !isMobile ? 'center' : 'flex-start',
                      color: active ? '#FFFFFF' : 'rgba(255,255,255,0.62)',
                      background: active ? `${sideColor.accent}55` : 'transparent',
                      borderLeft: active ? `3px solid ${sideColor.accent}` : '3px solid transparent',
                      textDecoration: 'none', fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      transition: 'background 120ms',
                      whiteSpace: 'nowrap', overflow: 'hidden',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <span style={{ flexShrink: 0, display: 'flex' }}><NavIcon d={item.icon} /></span>
                    {(!isMini || isMobile) && (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                    )}
                  </a>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Stopka sidebar — użytkownik + kolory */}
        <div style={{ borderTop: `1px solid rgba(255,255,255,0.1)`, flexShrink: 0 }}>
          {/* Wybór koloru — przycisk */}
          <button
            onClick={() => setShowColors(v => !v)}
            title="Zmień kolor menu"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: isMini && !isMobile ? '8px 0' : '8px 16px',
              justifyContent: isMini && !isMobile ? 'center' : 'flex-start',
              background: showColors ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)',
              fontSize: 12, transition: 'background 120ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' }}
          >
            <span style={{ flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </span>
            {(!isMini || isMobile) && <span>Kolor menu</span>}
          </button>

          {/* Paleta kolorów */}
          {showColors && (
            <div style={{ padding: isMini && !isMobile ? '8px 4px' : '8px 16px', background: 'rgba(0,0,0,0.25)' }}>
              {isMini && !isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                  {PALETTE.map(c => (
                    <button key={c.id} onClick={() => pickColor(c)} title={c.name}
                      style={{
                        width: 22, height: 22, borderRadius: '50%', background: c.bg,
                        border: sideColor.id === c.id ? '2px solid white' : '2px solid transparent',
                        cursor: 'pointer', outline: 'none',
                      }} />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {PALETTE.map(c => (
                    <button key={c.id} onClick={() => pickColor(c)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 6px', borderRadius: 6, cursor: 'pointer',
                        background: sideColor.id === c.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                        border: sideColor.id === c.id ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                      }}>
                      <span style={{ width: 14, height: 14, borderRadius: '50%', background: c.bg, border: '2px solid rgba(255,255,255,0.4)', flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, whiteSpace: 'nowrap' }}>{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Wybór maskotki */}
          {MASCOTS_ENABLED && <div style={{
            padding: isMini && !isMobile ? '6px 0' : '6px 16px',
            display:'flex', gap:8, justifyContent: isMini && !isMobile ? 'center' : 'flex-start', alignItems:'center',
            borderTop: `1px solid rgba(255,255,255,0.08)`,
          }}>
            {isMini && !isMobile ? (
              <button onClick={() => {
                const n = mascot === 'gazek' ? 'mala' : 'gazek'
                setMascot(n); localStorage.setItem('horekacrm_mascot', n)
              }} title={`Zamień na: ${mascot==='gazek'?'Malę 🐒':'Chef\'a 👨‍🍳'}`}
                style={{background:'none',border:'none',cursor:'pointer',fontSize:14}}>
                {mascot==='gazek'?'👨‍🍳':'🐒'}
              </button>
            ) : (
              <>
                <span style={{color:'rgba(255,255,255,0.45)',fontSize:11,whiteSpace:'nowrap'}}>Asystent:</span>
                {(['gazek','mala'] as const).map(m => (
                  <button key={m} onClick={() => { setMascot(m); localStorage.setItem('horekacrm_mascot', m) }}
                    style={{
                      background: mascot===m ? 'rgba(255,255,255,0.2)' : 'transparent',
                      border: `1px solid ${mascot===m ? 'rgba(255,255,255,0.4)' : 'transparent'}`,
                      borderRadius:8, cursor:'pointer', padding:'3px 8px',
                      color:'rgba(255,255,255,0.75)', fontSize:11, display:'flex', alignItems:'center', gap:4,
                    }}>
                    {m==='gazek'?'👨‍🍳':'🐒'} {m==='gazek'?'Chef':'Mala'}
                  </button>
                ))}
              </>
            )}
          </div>}

          {/* Użytkownik */}
          <div style={{
            padding: isMini && !isMobile ? '10px 0' : '10px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            justifyContent: isMini && !isMobile ? 'center' : 'flex-start',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', background: sideColor.accent,
              color: '#FFFFFF', fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, border: '2px solid rgba(255,255,255,0.2)', cursor: 'default',
            }} title={userEmail}>
              {userInitials}
            </div>
            {(!isMini || isMobile) && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail || '—'}
                </p>
                <button onClick={handleLogout}
                  style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ff6b6b' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' }}>
                  Wyloguj
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ════════════════ MAIN AREA ════════════════ */}
      <div style={{
        flex: 1, marginLeft: marginL,
        transition: 'margin-left 180ms ease',
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
      }}>
        {/* ── BANER DEMO ── */}
        <div style={{
          background: 'linear-gradient(90deg, #7C3AED 0%, #2563EB 100%)',
          color: '#fff', textAlign: 'center', fontSize: 12, fontWeight: 600,
          padding: '5px 16px', letterSpacing: '0.03em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>DEMO</span>
          Wersja demonstracyjna — dane są przykładowe i chronione zgodnie z RODO
          <span style={{ opacity: 0.7, fontWeight: 400, fontSize: 11 }}>| Ochrona danych: szyfrowanie AES-256, SSL/TLS</span>
        </div>
        {/* ── TOPBAR ── */}
        <header style={{
          height: 52, background: '#FFFFFF', borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10,
          position: 'sticky', top: 0, zIndex: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          {/* Hamburger — otwiera sidebar na mobile, zwija na desktop */}
          <button
            onClick={() => {
              if (isMobile) setMobileOpen(v => !v)
              else if (isDesktop) toggleCollapsed(!collapsed)
              // tablet: sidebar zawsze widoczny — brak akcji
            }}
            style={{
              background: 'none', border: 'none', cursor: isTablet ? 'default' : 'pointer',
              color: '#5A5A5A', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center',
              opacity: isTablet ? 0.3 : 1,
            }}
            title={isMobile ? 'Otwórz menu' : isDesktop ? (collapsed ? 'Rozwiń menu' : 'Zwiń menu') : 'Menu'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <span style={{ color: '#9CA3AF', fontSize: 12, whiteSpace: 'nowrap' }}>HoReCa CRM</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            <span style={{ color: sideColor.bg, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentLabel}
            </span>
          </div>

          {/* Prawa strona — dzwonek + pomoc + avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <a
              href="/akceptacje"
              title={nieprzeczytane > 0 ? `${nieprzeczytane} nowych powiadomień` : 'Powiadomienia'}
              style={{
                position: 'relative', color: '#5A5A5A', padding: 6, borderRadius: 6,
                display: 'flex', textDecoration: 'none',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F3F4F6' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              {nieprzeczytane > 0 && (
                <span style={{
                  position: 'absolute', top: 1, right: 1, minWidth: 16, height: 16,
                  padding: '0 4px', borderRadius: 8, background: '#DC2626', color: '#FFFFFF',
                  fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
                  border: '2px solid #FFFFFF', boxSizing: 'content-box',
                }}>
                  {nieprzeczytane > 99 ? '99+' : nieprzeczytane}
                </span>
              )}
            </a>
            <button
              onClick={() => setShowHelp(true)}
              title="Pomoc — opis funkcjonalności"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#5A5A5A', padding: 6, borderRadius: 6, display: 'flex',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F3F4F6' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/>
              </svg>
            </button>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: sideColor.accent,
              color: '#FFFFFF', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #E5E7EB', cursor: 'default',
            }} title={userEmail}>
              {userInitials}
            </div>
          </div>
        </header>

        {/* ── TREŚĆ STRONY ── */}
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>

      {/* ════════════════ MODAL POMOCY ════════════════ */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900">❓ Pomoc — HoReCa CRM</h2>
                <p className="text-xs text-gray-500 mt-0.5">Opis funkcjonalności wszystkich modułów systemu</p>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-700 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">✕</button>
            </div>

            {/* Intro */}
            <div className="px-5 pt-4 pb-2 flex-shrink-0">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
                <strong>HoReCa CRM</strong> to kompleksowy system do zarządzania obiektem gastronomicznym lub hotelowym — od rezerwacji i obsługi stolików,
                przez zarządzanie zakupami i sprzedażą, aż po integrację z POS, eService, bankiem i obsługę kadr.
                Menu boczne można zwinąć (strzałka), zmienić kolor (⚙️ Kolor menu) i dostosować do roli użytkownika.
              </div>
            </div>

            {/* Lista modułów */}
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                {HELP_MODULES.map(m => (
                  <div key={m.name} className="flex gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors">
                    <span className="text-xl flex-shrink-0 mt-0.5">{m.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {MASCOTS_ENABLED && <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                <strong>🤖 Asystent AI</strong> — asystent w prawym dolnym rogu — wita, informuje o terminach, rezerwacjach i pilnych sprawach.
                Można go przeciągać, zwijać i pytać o pomoc klikając przycisk <em>Pomoc</em> w dymku.
              </div>}
              <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
                <strong>🔒 WERSJA DEMO</strong> — dane prezentowane w systemie są przykładowe i nie zawierają rzeczywistych danych klientów.
                System działa w trybie demonstracyjnym. Dane są chronione zgodnie z RODO.
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowHelp(false)}
                className="w-full py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ MASKOTKA ════════════════ */}
      {MASCOTS_ENABLED && (mascot === 'gazek' ? <GazekAssistant /> : <MalaAssistant />)}
    </div>
  )
}
