
'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

// ===== STAŁE ZE SCHEMATÓW XSD =====

// ================================================================
// NAMESPACES — zgodne z produkcyjnymi plikami PUESC (DD815B.xml, DD818.xml, DD818B.xml)
// ================================================================
const NS_ENV      = 'http://www.mf.gov.pl/schematy/EDD/TraderToEDD/2025/03/'
const NS_HEADER   = 'http://www.mf.gov.pl/schematy/EDD/DDHEADERTYPE/2025/03/'
const NS_TYPES    = 'http://www.mf.gov.pl/schematy/EDD/DDTYPES/2025/03/'
const NS_815B     = 'http://www.mf.gov.pl/schematy/EDD/DD815B/2025/03/'
const NS_810      = 'http://www.mf.gov.pl/schematy/EDD/DD810/2025/03/'
const NS_812      = 'http://www.mf.gov.pl/schematy/EDD/DD812/2025/03/'
const NS_813      = 'http://www.mf.gov.pl/schematy/EDD/DD813/2025/03/'
const NS_813B     = 'http://www.mf.gov.pl/schematy/EDD/DD813B/2025/03/'
const NS_817      = 'http://www.mf.gov.pl/schematy/EDD/DD817/2025/03/'
const NS_818      = 'http://www.mf.gov.pl/schematy/EDD/DD818/2025/03/'
const NS_818B     = 'http://www.mf.gov.pl/schematy/EDD/DD818B/2025/03/'

// Stary obiekt NS dla kompatybilności ze starymi generatorami
const NS = {
  DD815B: NS_815B, DD810: NS_810, DD813: NS_813, DD817: NS_817,
  DD818: NS_818, DD818B: NS_818B, DD812: NS_812, DD813B: NS_813B,
  traderToEdd: NS_ENV, ddTypes: NS_TYPES, dd815b: NS_815B,
}

// ================================================================
// STAŁE DANE FIRMY — wpisane na stałe, wypełniają automatycznie
// ================================================================
const FIRMA = {
  nr_akcyzowy:     'PL32110004507',
  nip:             '6722078718',
  nazwa:           'BLUE PROJEKT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
  ulica:           'Krzywopłoty',
  nr_domu:         '41',
  kod:             '78-230',
  miasto:          'Karlino',
  typ:             '3',
  id_typ:          'excise',
  miejsce_ulica:   'Osiedle Buchwałowo',
  miejsce_nr_domu: '2',
  miejsce_kod:     '16-100',
  miejsce_miasto:  'Sokółka',
  urzad_wysylki:   'PL200331',
  grn:             '25PL3211YD1244850',
  grn_kod:         '0639',
}

// DeliveryTraderTypeType z ddEnumTypes.xsd
const TYPY_PODMIOTOW = [
  { v: '1',  l: '1 — SP — Skład podatkowy' },
  { v: '2',  l: '2 — ZO — Zarejestrowany odbiorca' },
  { v: '3',  l: '3 — PP — Podmiot pośredniczący' },
  { v: '4',  l: '4 — ZPG — Zużywający podmiot gospodarczy' },
  { v: '5',  l: '5 — AWK — Właściciel składu podatkowego' },
  { v: '6',  l: '6 — RCO — Zarejestrowany wysyłający' },
  { v: '7',  l: '7 — PZ — Podmiot zużywający' },
  { v: '8',  l: '8 — PNS — Podmiot nieobjęty systemem' },
  { v: '9',  l: '9 — PPW — Pośredniczący podmiot węglowy' },
  { v: '10', l: '10 — PN — Podmiot niszczący' },
  { v: '11', l: '11 — ZPF — Zużywający podmiot fizyczny' },
]

// DeliveryClosingFlagType
const TRYBY_ZAMKNIECIA = [
  { v: '1', l: '1 — Standardowe (przez podmiot odbierający — DD818)' },
  { v: '2', l: '2 — Przez podmiot wysyłający (DD818)' },
  { v: '3', l: '3 — Na podstawie deklaracji e-DD' },
  { v: '4', l: '4 — Na podstawie procedury eksportowej' },
]

// DeliveryDocumentModeFlag
const TRYBY_DOSTAWY = [
  { v: '0', l: '0 — Dostawa' },
  { v: '1', l: '1 — Zwrot' },
  { v: '2', l: '2 — Import' },
  { v: '3', l: '3 — Dostawa ze zbiornika' },
  { v: '4', l: '4 — Eksport' },
  { v: '5', l: '5 — Dostawa wyrobów węglowych' },
  { v: '6', l: '6 — Zwrot w dorejestrowaniu' },
  { v: '7', l: '7 — Dostawa na lotnisku' },
]

// ExciseDutyRateType
const STAWKI_AKCYZY = [
  { v: '1', l: '1 — Towary zwolnione z akcyzy ze względu na przeznaczenie' },
  { v: '2', l: '2 — Towary objęte zerową stawką akcyzy' },
]

// TransportModeCode
const RODZAJE_TRANSPORTU = [
  { v: '1', l: '1 — Transport morski' },
  { v: '2', l: '2 — Transport kolejowy' },
  { v: '3', l: '3 — Transport drogowy' },
  { v: '4', l: '4 — Transport lotniczy' },
  { v: '5', l: '5 — Przesyłka pocztowa' },
  { v: '6', l: '6 — Stałe instalacje przesyłowe (rurociąg)' },
  { v: '7', l: '7 — Transport śródlądowy' },
]

// TransportUnitCode
const KODY_JEDNOSTEK = [
  { v: '1',  l: '1 — Kontener' },
  { v: '2',  l: '2 — Pojazd / Cysterna' },
  { v: '3',  l: '3 — Przyczepa / Naczepa' },
  { v: '4',  l: '4 — Wagon kolejowy' },
  { v: '5',  l: '5 — Jednostka pływająca' },
  { v: '6',  l: '6 — Barka' },
  { v: '7',  l: '7 — Samolot' },
  { v: '8',  l: '8 — Rurociąg (stała instalacja)' },
]

// KindOfPackagesType (opakowania) — dla LPG
const KODY_OPAKOWAN = [
  { v: 'TK', l: 'TK — Cysterna (zbiornik)' },
  { v: 'TY', l: 'TY — Cysterna cylindryczna' },
  { v: 'VG', l: 'VG — Luzem (stały, ziarno)' },
  { v: 'VL', l: 'VL — Luzem (ciecz)' },
  { v: 'VQ', l: 'VQ — Luzem (gaz)' },
]

// GlobalConclusionOfReceipt
const WYNIKI_ODBIORU = [
  { v: '1',  l: '1 — Odbiór bez zastrzeżeń' },
  { v: '2',  l: '2 — Odbiór z zastrzeżeniami (ubytek/nadwyżka)' },
  { v: '21', l: '21 — Wyprowadzenie zaakceptowane bez zastrzeżeń' },
  { v: '22', l: '22 — Wyprowadzenie zaakceptowane z zastrzeżeniami' },
  { v: '23', l: '23 — Wyprowadzenie odmówione' },
  { v: '3',  l: '3 — Odmowa przyjęcia całości przesyłki' },
  { v: '4',  l: '4 — Odmowa przyjęcia części przesyłki' },
]

// CancellationReasonCode (1 cyfra, 0-4)
const PRZYCZYNY_ANULOWANIA = [
  { v: '0', l: '0 — Błąd wpisu' },
  { v: '1', l: '1 — Przerwana transakcja handlowa' },
  { v: '2', l: '2 — Duplikat dokumentu' },
  { v: '3', l: '3 — Przemieszczenie nie rozpoczęło się w dniu wysyłki' },
  { v: '4', l: '4 — Inne' },
]

// Kody CN dla LPG
const KODY_CN = [
  { v: '27111900', e: 'E500', l: '27111900 — E500 — LPG (propan-butan skroplony) ★ najczęściej' },
  { v: '27111200', e: 'E500', l: '27111200 — E500 — Propan skroplony LPG' },
  { v: '27111300', e: 'E500', l: '27111300 — E500 — Butan skroplony LPG' },
  { v: '27111100', e: 'E500', l: '27111100 — E500 — Gaz ziemny skroplony (LNG)' },
  { v: '27112100', e: 'E500', l: '27112100 — E500 — Gaz ziemny w stanie gazowym (CNG)' },
  { v: '27102000', e: 'E600', l: '27102000 — E600 — Oleje napędowe (diesel)' },
  { v: '27101290', e: 'E200', l: '27101290 — E200 — Benzyna silnikowa' },
]

// JourneyTimeType pattern: H01-H24 lub D01-D62 (kraj) / D01-D92 (UE)
const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white"
const inputErr = "px-3 py-2 border border-red-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 w-full bg-red-50"
const labelCls = "text-xs font-medium text-gray-600 uppercase tracking-wide"
const reqMark = <span className="text-red-500 ml-0.5">*</span>
const optMark = <span className="text-gray-400 ml-1 text-xs font-normal normal-case">(opcjonalne)</span>

type Komunikat = 'DD815B' | 'DD810' | 'DD813' | 'DD817' | 'DD818' | 'DD818B' | 'DD812' | 'DD813B'

type Historia = {
  id: string; typ: Komunikat; msgId: string
  arc?: string; lrn?: string
  data: string; xml: string
  // Dane DD815B do zaciągania do DD818B
  odbiorcy?: any[]
  kodCN?: string
  exciseCode?: string
  lrnData?: {
    nrFaktury?: string; dataFaktury?: string; dataWysylki?: string
    transportKod?: string; jednostkaKod?: string; jednostkaOzn?: string
  }
}

// ===== POMOCNIK: TRADER XML =====
function traderXml(tag: string, t: any, ns = '', lang = 'pl'): string {
  // deliveryTraderType: excise/podmiot=3, personal/osoba=8, tax=typ podmiotu
  const delivType = t.id_typ === 'personal' ? '8' : t.id_typ === 'excise' ? '3' : (t.typ || '3')
  const usedLang = t.lang || lang
  const idTag = t.id_typ === 'excise'
    ? `<ddTypes:Traderid><ddTypes:ExciseNumber>${t.id}</ddTypes:ExciseNumber></ddTypes:Traderid>`
    : t.id_typ === 'tax'
    ? `<ddTypes:Traderid><ddTypes:TaxNumber>${t.id}</ddTypes:TaxNumber></ddTypes:Traderid>`
    : `<ddTypes:Traderid><ddTypes:PersonalId>${t.id}</ddTypes:PersonalId></ddTypes:Traderid>`
  return `<ddTypes:${tag} deliveryTraderType="${delivType}" language="${usedLang}">
        ${idTag}
        <ddTypes:TraderName>${esc(t.nazwa)}</ddTypes:TraderName>
        <ddTypes:StreetName>${esc(t.ulica)}</ddTypes:StreetName>
        ${t.nr_domu ? `<ddTypes:StreetNumber>${esc(t.nr_domu)}</ddTypes:StreetNumber>` : ''}
        <ddTypes:Postcode>${esc(t.kod)}</ddTypes:Postcode>
        <ddTypes:City>${esc(t.miasto)}</ddTypes:City>
      </ddTypes:${tag}>`
}

function officeXml(tag: string, code: string): string {
  return `<ddTypes:${tag}><ddTypes:ReferenceNumber>${code}</ddTypes:ReferenceNumber></ddTypes:${tag}>`
}

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function now(): { date: string; time: string } {
  const d = new Date()
  return {
    date: d.toISOString().split('T')[0],
    time: d.toTimeString().slice(0, 8),
  }
}

// ===== PUSTE TRADER =====
function emptyTrader(typ = '1') {
  return { id: '', id_typ: 'excise', typ, nazwa: '', ulica: '', nr_domu: '', kod: '', miasto: '' }
}

// ===== HELPER: buduj namespace'y XSD z wersji =====
function buildNs(v: string) {
  return {
    ENV:    `http://www.mf.gov.pl/schematy/EDD/TraderToEDD/${v}/`,
    HEADER: `http://www.mf.gov.pl/schematy/EDD/DDHEADERTYPE/${v}/`,
    TYPES:  `http://www.mf.gov.pl/schematy/EDD/DDTYPES/${v}/`,
    DD815B: `http://www.mf.gov.pl/schematy/EDD/DD815B/${v}/`,
    DD810:  `http://www.mf.gov.pl/schematy/EDD/DD810/${v}/`,
    DD812:  `http://www.mf.gov.pl/schematy/EDD/DD812/${v}/`,
    DD813:  `http://www.mf.gov.pl/schematy/EDD/DD813/${v}/`,
    DD813B: `http://www.mf.gov.pl/schematy/EDD/DD813B/${v}/`,
    DD817:  `http://www.mf.gov.pl/schematy/EDD/DD817/${v}/`,
    DD818:  `http://www.mf.gov.pl/schematy/EDD/DD818/${v}/`,
    DD818B: `http://www.mf.gov.pl/schematy/EDD/DD818B/${v}/`,
  }
}

// ===== KOMPONENT: SEKCJA =====
function Sekcja({ nr, tytul, children, kolor = 'blue' }: { nr: string; tytul: string; children: React.ReactNode; kolor?: string }) {
  const kolory: Record<string, string> = {
    blue: 'bg-blue-600', green: 'bg-green-600', orange: 'bg-orange-500',
    red: 'bg-red-600', purple: 'bg-purple-600', gray: 'bg-gray-600',
  }
  return (
    <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-6 h-6 ${kolory[kolor]} text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`}>{nr}</span>
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{tytul}</span>
      </div>
      {children}
    </div>
  )
}

// ===== KOMPONENT: POLE =====
function Pole({ label, wymagane, children, info, blad }: { label: string; wymagane?: boolean; children: React.ReactNode; info?: string; blad?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelCls}>{label}{wymagane ? reqMark : optMark}</label>
      {children}
      {info && <p className="text-xs text-gray-400">{info}</p>}
      {blad && <p className="text-xs text-red-600">{blad}</p>}
    </div>
  )
}

// ===== KOMPONENT: TRADER FORM =====
function TraderForm({ prefix, label, val, onChange, showIdTyp = true, klienci = [] }: {
  prefix: string; label: string; val: any; onChange: (v: any) => void; showIdTyp?: boolean; klienci?: any[]
}) {
  const f = (k: string, v: string) => onChange({ ...val, [k]: v })
  const [showK, setShowK] = React.useState(false)
  const [szukaj, setSzukaj] = React.useState('')

  const klienciFiltrowani = szukaj.trim().length >= 1
    ? klienci.filter((k: any) =>
        k.nazwa?.toLowerCase().includes(szukaj.toLowerCase()) ||
        k.miasto?.toLowerCase().includes(szukaj.toLowerCase()) ||
        k.nip?.includes(szukaj)
      )
    : klienci

  function wybierzKlienta(k: any) {
    const rawAdres = k.adres || ''
    const nrMatch = rawAdres.match(/^(.*?)\s+(\d+[A-Za-z]?(?:\/\d+)?)$/)
    const ulicaCzysts = (nrMatch ? nrMatch[1] : rawAdres).replace(/^ul\.?\s*/i, '').replace(/^ulica\s*/i, '').trim()
    const nrDomu = nrMatch ? nrMatch[2] : ''
    onChange({ ...val,
      id: k.nip || '',
      id_typ: 'tax',
      nazwa: k.nazwa || '',
      ulica: ulicaCzysts,
      nr_domu: nrDomu,
      kod: k.kod_pocztowy || '',
      miasto: k.miasto || '',
    })
    setShowK(false)
    setSzukaj('')
  }

  return (
    <div className="space-y-3">
      {klienci.length > 0 && (
        <div>
          <button type="button" onClick={() => { setShowK(!showK); setSzukaj('') }}
            className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1.5">
            👤 Zaciągnij z bazy klientów ({klienci.length}) {showK ? '▲' : '▼'}
          </button>
          {showK && (
            <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 relative">
              {/* Pole wyszukiwania */}
              <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                <input
                  autoFocus
                  type="text"
                  value={szukaj}
                  onChange={e => setSzukaj(e.target.value)}
                  placeholder="🔍 Wpisz nazwę, miasto lub NIP..."
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {szukaj && (
                  <p className="text-xs text-gray-400 mt-1 px-1">
                    {klienciFiltrowani.length} wyników dla „{szukaj}"
                  </p>
                )}
              </div>
              <div className="max-h-56 overflow-y-auto">
                {klienciFiltrowani.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-gray-400 text-center">Brak wyników dla „{szukaj}"</p>
                ) : (
                  klienciFiltrowani.map((k: any) => (
                    <button type="button" key={k.id} onClick={() => wybierzKlienta(k)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors">
                      <p className="font-medium text-gray-900">{k.nazwa}</p>
                      <p className="text-gray-400 mt-0.5">
                        {k.nip ? `NIP: ${k.nip}` : ''}
                        {k.adres ? ` · ${k.adres}` : ''}
                        {(k.kod_pocztowy || k.miasto) ? `, ${[k.kod_pocztowy, k.miasto].filter(Boolean).join(' ')}` : ''}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {showIdTyp && (
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Typ identyfikatora{reqMark}</label>
          <select value={val.id_typ} onChange={e => f('id_typ', e.target.value)} className={inputCls}>
            <option value="excise">Nr akcyzowy (13 zn.)</option>
            <option value="tax">NIP (10 cyfr)</option>
            <option value="personal">Nr personalny</option>
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className={labelCls}>
          {val.id_typ === 'tax' ? 'NIP' : val.id_typ === 'personal' ? 'Nr personalny' : 'Nr akcyzowy'}{reqMark}
        </label>
        <input value={val.id} onChange={e => f('id', e.target.value)}
          placeholder={val.id_typ === 'tax' ? '10 cyfr' : val.id_typ === 'personal' ? 'do 16 zn.' : 'XX000000000000'}
          maxLength={val.id_typ === 'tax' ? 10 : val.id_typ === 'personal' ? 16 : 13}
          className={inputCls} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Typ podmiotu{reqMark}</label>
        <select value={val.typ} onChange={e => f('typ', e.target.value)} className={inputCls}>
          {TYPY_PODMIOTOW.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1 col-span-2">
        <label className={labelCls}>Nazwa{reqMark}</label>
        <input value={val.nazwa} onChange={e => f('nazwa', e.target.value)} maxLength={182} className={inputCls} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Ulica{reqMark}</label>
        <input value={val.ulica} onChange={e => f('ulica', e.target.value)} maxLength={65} className={inputCls} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Nr domu{optMark}</label>
        <input value={val.nr_domu} onChange={e => f('nr_domu', e.target.value)} maxLength={11} className={inputCls} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Kod pocztowy{reqMark}</label>
        <input value={val.kod} onChange={e => f('kod', e.target.value)} maxLength={10} className={inputCls} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Miejscowość{reqMark}</label>
        <input value={val.miasto} onChange={e => f('miasto', e.target.value)} maxLength={50} className={inputCls} />
      </div>
    </div>
    </div>
  )
}

// ===== GŁÓWNY KOMPONENT =====
// ============================================================
// KOMPONENT: DD704 Viewer — parsuje błędy z PUESC
// ============================================================
function DD704Viewer({ xml }: { xml: string }) {
  const [bledy, setBledy] = React.useState<{ kod?: string; opis?: string; linia?: string }[]>([])
  const [raw, setRaw] = React.useState(false)

  React.useEffect(() => {
    if (!xml) return
    const found: typeof bledy = []
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'text/xml')
      const selectors = ['FunctionalError', 'ValidationError', 'Error', 'error', 'ExplanationCode']
      for (const sel of selectors) {
        doc.querySelectorAll(sel).forEach(el => {
          const kod = el.querySelector('ErrorCode, ReasonCode, Code')?.textContent?.trim() || ''
          const opis = el.querySelector('ErrorReason, Reason, Text, Description, Message')?.textContent?.trim()
              || (el.children.length === 0 ? el.textContent?.trim() : '') || ''
          const linia = el.querySelector('ErrorLocation, Location, Line')?.textContent?.trim() || ''
          if (opis && opis.length > 3) found.push({ kod, opis, linia })
        })
        if (found.length > 0) break
      }
      if (found.length === 0) {
        const pe = doc.querySelector('parsererror')
        if (pe) found.push({ opis: pe.textContent?.trim().slice(0, 500) || 'Błąd parsowania XML' })
      }
    } catch (e: any) { found.push({ opis: 'Błąd: ' + String(e) }) }
    setBledy(found)
  }, [xml])

  if (bledy.length > 0 && !raw) return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-red-700">Znaleziono {bledy.length} błąd(ów):</p>
        <button onClick={() => setRaw(true)} className="text-xs text-gray-400 hover:text-gray-600">Pokaż surowy XML</button>
      </div>
      {bledy.map((b, i) => (
        <div key={i} className="border border-red-200 bg-red-50 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <span className="text-red-500 text-lg flex-shrink-0">⚠</span>
            <div>
              {b.kod && <p className="text-xs font-bold text-red-700 mb-1 font-mono">Kod błędu: {b.kod}</p>}
              {b.linia && <p className="text-xs text-red-500 mb-1">Lokalizacja: {b.linia}</p>}
              <p className="text-sm text-red-800">{b.opis}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
  return (
    <div>
      {bledy.length > 0 && <button onClick={() => setRaw(false)} className="text-xs text-blue-600 mb-3 hover:underline">← Sparsowane błędy</button>}
      {bledy.length === 0 && <p className="text-sm text-gray-400 mb-3">Nie wykryto błędów automatycznie — surowy XML:</p>}
      <pre className="text-xs font-mono bg-gray-50 p-3 rounded-xl border border-gray-200 overflow-x-auto whitespace-pre-wrap">{xml.slice(0, 8000)}</pre>
    </div>
  )
}

export default function EMCSPage() {
  const supabaseClient = createClient()
  const [klienci, setKlienci] = useState<any[]>([])
  const [tab, setTab] = useState<Komunikat>('DD815B')
  const [historia, setHistoria] = useState<Historia[]>([])
  const [showHistoria, setShowHistoria] = useState(false)
  const [showXML, setShowXML] = useState(false)
  const [xmlPodglad, setXmlPodglad] = useState('')
  const [msgCounter, setMsgCounter] = useState(1)
  const [sukces, setSukces] = useState('')
  const [daneFirmy, setDaneFirmy] = useState<{
    nr_akcyzowy: string; nazwa: string; ulica: string; nr_domu: string
    kod: string; miasto: string; urzad: string; nip: string; typ_podmiotu: string
  }>({
    nr_akcyzowy: FIRMA.nr_akcyzowy,
    nazwa: FIRMA.nazwa,
    ulica: FIRMA.ulica,
    nr_domu: FIRMA.nr_domu,
    kod: FIRMA.kod,
    miasto: FIRMA.miasto,
    urzad: FIRMA.urzad_wysylki,
    nip: FIRMA.nip,
    typ_podmiotu: FIRMA.typ,
  })
  const [showUstawienia, setShowUstawienia] = useState(false)
  const [nsVersion, setNsVersion] = useState('2025/03')

  useEffect(() => {
    supabaseClient.from('klienci').select('id,nazwa,nip,adres,kod_pocztowy,miasto,telefon').order('nazwa').limit(500)
      .then(({ data }) => { if (data) setKlienci(data) })
    // Wersja XSD — ładuj z firma_dane (admin może zmienić w /emcs/aktualizacje)
    supabaseClient.from('firma_dane').select('wartosc').eq('klucz', 'emcs_ns_wersja').single()
      .then(({ data }) => { if (data?.wartosc) setNsVersion(data.wartosc) })
    const s = localStorage.getItem('emcs_firma')
    if (s) try { setDaneFirmy(JSON.parse(s)) } catch {}
    const c = localStorage.getItem('emcs_cnt')
    if (c) setMsgCounter(parseInt(c))
    const h = localStorage.getItem('emcs_hist')
    if (h) try { setHistoria(JSON.parse(h)) } catch {}
  }, [])

  function zapiszFirme() {
    localStorage.setItem('emcs_firma', JSON.stringify(daneFirmy))
    setSukces('Dane firmy zapisane!'); setTimeout(() => setSukces(''), 2000)
  }

  function nextMsgId(): string {
    const id = String(msgCounter).padStart(4, '0')
    const nowy = msgCounter + 1
    setMsgCounter(nowy)
    localStorage.setItem('emcs_cnt', String(nowy))
    return id
  }

  function addHistoria(h: Omit<Historia, 'id'>) {
    const nowa = [{ ...h, id: crypto.randomUUID() }, ...historia].slice(0, 100)
    setHistoria(nowa)
    localStorage.setItem('emcs_hist', JSON.stringify(nowa))
  }

  function pobierzXML(xml: string, nazwa: string) {
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = nazwa
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function kopiujXML(xml: string) {
    navigator.clipboard.writeText(xml)
    setSukces('Skopiowano do schowka!'); setTimeout(() => setSukces(''), 2000)
  }

  // ── Wczytaj XML (DD815B lub DD704) z pliku ──────────────────
  const [showImportXml, setShowImportXml] = useState(false)
  const [importXmlTyp, setImportXmlTyp] = useState<'xml'|'dd704'>('xml')
  const [importXmlContent, setImportXmlContent] = useState('')
  const [importXmlNazwa, setImportXmlNazwa] = useState('')

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>, typ: 'xml'|'dd704') {
    const file = e.target.files?.[0]
    if (!file) return
    setImportXmlNazwa(file.name)
    setImportXmlTyp(typ)
    const reader = new FileReader()
    reader.onload = ev => {
      const txt = ev.target?.result as string
      setImportXmlContent(txt)
      setShowImportXml(true)
      // Jeśli to XML komunikatu — dodaj do historii
      if (typ === 'xml') {
        const typMatch = txt.match(/<(dd815b|dd818|dd818b|dd810|dd813|dd812|dd817):DD(\w+)/)
        const typKom = typMatch ? ('DD' + typMatch[2]) as Komunikat : 'DD815B'
        const lrnMatch = txt.match(/<dd815b:LocalReferenceNumber>([^<]+)</)
        const arcMatch = txt.match(/<ddTypes:DeliveryDocumentAdministrativeReferenceCode>([^<]+)</)
        const msgIdMatch = txt.match(/<ddHeaderType:MessageIdentifier>([^<]+)</)
        addHistoria({
          typ: typKom, msgId: msgIdMatch?.[1] || 'import',
          lrn: lrnMatch?.[1], arc: arcMatch?.[1],
          data: new Date().toISOString(), xml: txt,
        })
        setSukces(`Wczytano ${typKom} — dodano do historii!`)
        setTimeout(() => setSukces(''), 3000)
        setShowImportXml(true)
        setXmlPodglad(txt)
        setShowXML(true)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const props = { daneFirmy, nextMsgId, addHistoria, pobierzXML, kopiujXML, setXmlPodglad, setShowXML, setSukces, klienci, historia, nsVersion }

  const tabs: { k: Komunikat; l: string; opis: string; kol: string }[] = [
    { k: 'DD815B', l: 'DD815B', opis: 'Projekt e-DD B (LPG)', kol: 'blue' },
    { k: 'DD810',  l: 'DD810',  opis: 'Anulowanie e-DD', kol: 'red' },
    { k: 'DD813',  l: 'DD813',  opis: 'Zmiana miejsca przeznaczenia', kol: 'yellow' },
    { k: 'DD813B', l: 'DD813B', opis: 'Zmiana miejsca przezn. (zbiorczy)', kol: 'yellow' },
    { k: 'DD812',  l: 'DD812',  opis: 'Powiadomienie o przeładunku', kol: 'orange' },
    { k: 'DD817',  l: 'DD817',  opis: 'Powiadomienie o przybyciu', kol: 'purple' },
    { k: 'DD818',  l: 'DD818',  opis: 'Raport odbioru', kol: 'green' },
    { k: 'DD818B', l: 'DD818B', opis: 'Raport odbioru B (zbiorczy)', kol: 'green' },
  ]

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Generator komunikatów EMCS PL 2</h1>
          <p className="text-xs text-gray-400 mt-0.5">Schematy XSD v2025/03 · System PUESC · {daneFirmy.nr_akcyzowy}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowUstawienia(v => !v)}
            className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">⚙ Dane firmy</button>
          <label className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center gap-1.5" title="Wczytaj XML komunikatu z pliku">
            📂 Wczytaj XML
            <input type="file" accept=".xml" className="hidden" onChange={e => handleImportFile(e, 'xml')} />
          </label>
          <label className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 cursor-pointer flex items-center gap-1.5" title="Wczytaj dokument DD704 z błędami z PUESC">
            🔴 Błędy DD704
            <input type="file" accept=".xml,.pdf" className="hidden" onChange={e => handleImportFile(e, 'dd704')} />
          </label>
          <button onClick={() => setShowHistoria(true)}
            className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">📋 Historia ({historia.length})</button>
        </div>
      </div>

      {sukces && <div className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mb-3">{sukces}</div>}

      {/* Dane firmy */}
      {showUstawienia && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">Dane Twojej firmy (wypełniane automatycznie w nagłówku)</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-3">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Nr akcyzowy (Nadawca)</label>
              <input value={daneFirmy.nr_akcyzowy} onChange={e => setDaneFirmy(f => ({ ...f, nr_akcyzowy: e.target.value }))} maxLength={13} className={inputCls} />
              <p className="text-xs text-gray-400">Wpisywany w pole Nadawca komunikatu</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Nazwa firmy</label>
              <input value={daneFirmy.nazwa} onChange={e => setDaneFirmy(f => ({ ...f, nazwa: e.target.value }))} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Kod urzędu wysyłki</label>
              <input value={daneFirmy.urzad} onChange={e => setDaneFirmy(f => ({ ...f, urzad: e.target.value }))} maxLength={8} placeholder="np. PL401000" className={inputCls} />
              <p className="text-xs text-gray-400">8 znaków: PL + 6 cyfr/liter</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Typ podmiotu</label>
              <select value={daneFirmy.typ_podmiotu} onChange={e => setDaneFirmy(f => ({ ...f, typ_podmiotu: e.target.value }))} className={inputCls}>
                {TYPY_PODMIOTOW.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Ulica</label>
              <input value={daneFirmy.ulica} onChange={e => setDaneFirmy(f => ({ ...f, ulica: e.target.value }))} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Nr domu</label>
              <input value={daneFirmy.nr_domu} onChange={e => setDaneFirmy(f => ({ ...f, nr_domu: e.target.value }))} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Kod pocztowy</label>
              <input value={daneFirmy.kod} onChange={e => setDaneFirmy(f => ({ ...f, kod: e.target.value }))} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Miasto</label>
              <input value={daneFirmy.miasto} onChange={e => setDaneFirmy(f => ({ ...f, miasto: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={zapiszFirme} className="text-xs bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700">Zapisz</button>
            <span className="text-xs text-gray-400 self-center">Licznik ID wiadomości: <span className="font-mono font-medium">{msgCounter}</span></span>
            <button onClick={() => { setMsgCounter(1); localStorage.setItem('emcs_cnt', '1'); setSukces('Licznik zresetowany!'); setTimeout(() => setSukces(''), 2000) }}
              className="text-xs border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50 text-gray-500">Reset licznika</button>
          </div>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800 font-medium mb-1">Jak wysłać komunikat do PUESC?</p>
            <p className="text-xs text-blue-700">1. Pobierz plik XML · 2. Wyślij e-mail na: <span className="font-mono">emcs.hd@ncts-centrum.mofnet.gov.pl</span> lub przez portal PUESC · 3. Jeden komunikat = jeden e-mail</p>
            <p className="text-xs text-blue-600 mt-1">Helpdesk EMCS: tel. 42 638 80 17</p>
          </div>
        </div>
      )}

      {/* Wybór komunikatu */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {tabs.map(t => {
          const aktywny = tab === t.k
          const kolory: Record<string, string> = {
            blue: aktywny ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:border-blue-300',
            red: aktywny ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 hover:border-red-300',
            yellow: aktywny ? 'bg-yellow-500 text-white border-yellow-500' : 'border-gray-200 hover:border-yellow-300',
            orange: aktywny ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 hover:border-orange-300',
            purple: aktywny ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 hover:border-purple-300',
            green: aktywny ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 hover:border-green-300',
          }
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`border rounded-xl px-3 py-2 text-left transition-all ${kolory[t.kol]}`}>
              <div className={`text-sm font-bold ${aktywny ? '' : 'text-gray-700'}`}>{t.l}</div>
              <div className={`text-xs ${aktywny ? 'opacity-80' : 'text-gray-500'}`}>{t.opis}</div>
            </button>
          )
        })}
      </div>

      {/* Formularze */}
      {tab === 'DD815B' && <FormDD815B {...props} />}
      {tab === 'DD810'  && <FormDD810  {...props} />}
      {tab === 'DD813'  && <FormDD813  {...props} />}
      {tab === 'DD813B' && <FormDD813B {...props} />}
      {tab === 'DD812'  && <FormDD812  {...props} />}
      {tab === 'DD817'  && <FormDD817  {...props} />}
      {tab === 'DD818'  && <FormDD818  {...props} />}
      {tab === 'DD818B' && <FormDD818B {...props} />}

      {/* Modal: Przeglądarka DD704 (błędy PUESC) */}
      {importXmlTyp === 'dd704' && showImportXml && importXmlContent && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl flex flex-col" style={{ maxHeight: '92vh' }}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-red-700">🔴 Dokument DD704 — Błędy PUESC</h2>
                <p className="text-xs text-gray-400 mt-0.5">{importXmlNazwa}</p>
              </div>
              <button onClick={() => setShowImportXml(false)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <DD704Viewer xml={importXmlContent} />
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={() => pobierzXML(importXmlContent, importXmlNazwa)}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">⬇ Pobierz</button>
              <button onClick={() => setShowImportXml(false)}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700">Zamknij</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Podgląd XML */}
      {showXML && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-3xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-medium">Podgląd XML</h2>
              <button onClick={() => setShowXML(false)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-gray-800 max-h-96 overflow-y-auto">{xmlPodglad}</pre>
            <div className="flex gap-2 mt-4">
              <button onClick={() => kopiujXML(xmlPodglad)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">\ud83d\udccb Kopiuj</button>
              <button onClick={() => setShowXML(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Zamknij</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Historia */}
      {showHistoria && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-4xl" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">📋 Historia komunikatów ({historia.length})</h2>
                <p className="text-xs text-gray-400 mt-0.5">Przechowywane lokalnie · max 100 wpisów</p>
              </div>
              <button onClick={() => setShowHistoria(false)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            {historia.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-gray-400 mb-2">Brak historii.</p>
                <p className="text-xs text-gray-300">Wygeneruj komunikat lub wczytaj XML z pliku.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historia.map(h => {
                  const kolory: Record<string, string> = {
                    DD815B: 'bg-blue-50 text-blue-700 border-blue-200',
                    DD818: 'bg-green-50 text-green-700 border-green-200',
                    DD818B: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    DD810: 'bg-red-50 text-red-700 border-red-200',
                    DD813: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                    DD817: 'bg-purple-50 text-purple-700 border-purple-200',
                  }
                  const kol = kolory[h.typ] || 'bg-gray-50 text-gray-700 border-gray-200'
                  return (
                    <div key={h.id} className="border border-gray-100 rounded-xl p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2.5 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${kol}`}>{h.typ}</span>
                          <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">MSG:{h.msgId}</span>
                          {h.lrn && <span className="text-xs text-blue-600 font-mono">LRN:{h.lrn}</span>}
                          {h.arc && <span className="text-xs text-green-600 font-mono">ARC:{h.arc}</span>}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{new Date(h.data).toLocaleString('pl-PL')}</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => { setXmlPodglad(h.xml); setShowXML(true); setShowHistoria(false) }}
                          className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-white hover:border-gray-300">
                          👁 Podgląd XML
                        </button>
                        <button onClick={() => pobierzXML(h.xml, `${h.typ}_${h.msgId || h.lrn || 'draft'}.xml`)}
                          className="text-xs px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100">
                          ⬇ Pobierz XML
                        </button>
                        <button onClick={() => kopiujXML(h.xml)}
                          className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">
                          📋 Kopiuj
                        </button>
                        {h.typ === 'DD815B' && h.odbiorcy && h.odbiorcy.length > 0 && (
                          <button onClick={() => {
                            setTab('DD818B')
                            setShowHistoria(false)
                            setSukces('Przełączono na DD818B — kliknij "Zaciągnij z DD815B" w formularzu')
                            setTimeout(() => setSukces(''), 4000)
                          }}
                            className="text-xs px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100">
                            → Zaciągnij do DD818B
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex justify-between mt-4 pt-3 border-t border-gray-100">
              <button onClick={() => { setHistoria([]); localStorage.removeItem('emcs_hist'); }}
                className="text-xs text-red-500 hover:text-red-700">Wyczyść historię</button>
              <button onClick={() => setShowHistoria(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Zamknij</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== PRZYCISKI AKCJI =====
function Akcje({ onPodglad, onPobierz, onKopiuj, typ }: { onPodglad: () => void; onPobierz: () => void; onKopiuj: () => void; typ: string }) {
  const kolory: Record<string, string> = {
    DD815B: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
    DD810: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
    DD813: 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
    DD813B: 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
    DD812: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100',
    DD817: 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100',
    DD818: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
    DD818B: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
  }
  return (
    <div className="flex gap-3 pt-3 border-t border-gray-100 mt-4">
      <button onClick={onPodglad} className={`px-4 py-2.5 text-sm border rounded-lg transition-colors ${kolory[typ] || kolory.DD815B}`}>
        \ud83d\udc41 Podgląd XML
      </button>
      <button onClick={onPobierz} className="px-6 py-2.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
        ⬇ Pobierz XML
      </button>
      <button onClick={onKopiuj} className="px-4 py-2.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
        \ud83d\udccb Kopiuj
      </button>
    </div>
  )
}

// ============================================================
// ===== DD815B — Projekt e-DD B (dla LPG) =====
// ============================================================
function FormDD815B({ daneFirmy, nextMsgId, addHistoria, pobierzXML, kopiujXML, setXmlPodglad, setShowXML, setSukces, klienci = [], nsVersion = '2025/03' }: any) {
  const ns = buildNs(nsVersion)
  const [d815bJezyk, setD815bJezyk] = useState('pl')
  const [lrn, setLrn] = useState('')
  const [tryb, setTryb] = useState('0') // DeliveryDocumentModeFlag
  const [stawka, setStawka] = useState('1') // ExciseDutyRateType
  const [odroczony, setOdroczony] = useState('0') // DeferredSubmissionFlag
  const [nrFaktury, setNrFaktury] = useState('')
  const [dataFaktury, setDataFaktury] = useState('')
  const [dataWysylki, setDataWysylki] = useState(new Date().toISOString().split('T')[0])
  const [czasWysylki, setCzasWysylki] = useState('08:00:00')
  const [czasPrzewozuTyp, setCzasPrzewozuTyp] = useState('H')
  const [czasPrzewozuVal, setCzasPrzewozuVal] = useState('04')
  const [trybZamkniecia, setTrybZamkniecia] = useState('1')
  // Sekcja 2 - Podmiot wysyłający
  const [wysylajacy, setWysylajacy] = useState(() => ({
    id: FIRMA.nr_akcyzowy, id_typ: FIRMA.id_typ as string,
    typ: FIRMA.typ, nazwa: FIRMA.nazwa,
    ulica: FIRMA.ulica, nr_domu: FIRMA.nr_domu,
    kod: FIRMA.kod, miasto: FIRMA.miasto,
  }))
  // Sekcja 3 - Miejsce wysyłki
  const [taSamaMiejscWys, setTaSamaMiejscWys] = useState(true)
  const [miejsceWysylki, setMiejsceWysylki] = useState(() => ({
    id: FIRMA.nr_akcyzowy, id_typ: 'excise', typ: FIRMA.typ,
    nazwa: FIRMA.nazwa,
    ulica: FIRMA.miejsce_ulica, nr_domu: FIRMA.miejsce_nr_domu,
    kod: FIRMA.miejsce_kod, miasto: FIRMA.miejsce_miasto,
  }))
  // Sekcja 4 - Urząd wysyłki
  const [urzadWysylki, setUrzadWysylki] = useState(FIRMA.urzad_wysylki)
  // Sekcja 5 - Odbiorcy (może być wielu dla DD815B)
  const [odbiorcy, setOdbiorcy] = useState([{
    odbiorca: emptyTrader('2'), miejsceOdbioru: emptyTrader('2'), urzad: '', showMiejsce: false,
  }])
  // Sekcja 7 - Gwarancja transportu (opcjonalna)
  const [showGwarTransport, setShowGwarTransport] = useState(false)
  const [gwarTransportGRN, setGwarTransportGRN] = useState(FIRMA.grn)
  const [gwarTransportKod, setGwarTransportKod] = useState(FIRMA.grn_kod)
  const [gwarTransportTIN, setGwarTransportTIN] = useState(FIRMA.nip)
  // Sekcja 8 - Gwarancja magazynowania (opcjonalna)
  const [showGwarMagazyn, setShowGwarMagazyn] = useState(false)
  const [gwarMagazynGRN, setGwarMagazynGRN] = useState('')
  const [gwarMagazynKod, setGwarMagazynKod] = useState('')
  const [gwarMagazynTIN, setGwarMagazynTIN] = useState('')
  // Sekcja 9 - Transport
  const [transportKod, setTransportKod] = useState('3')
  const [transportInfo, setTransportInfo] = useState('')
  // Sekcja 10 - Szczegóły transportu
  const [jednostkaKod, setJednostkaKod] = useState('2')
  const [jednostkaOzn, setJednostkaOzn] = useState('')
  const [transportDodInfo, setTransportDodInfo] = useState('')
  // Sekcja 11 - Wyrób
  const [kodCN, setKodCN] = useState('27111900')
  const [exciseCode, setExciseCode] = useState('E500')
  const [ilosc, setIlosc] = useState('')
  const [masaBrutto, setMasaBrutto] = useState('')
  const [masaNetto, setMasaNetto] = useState('')
  const [taraCysterny, setTaraCysterny] = useState('')
  const [gestosc, setGestosc] = useState('')
  const [kodOpakowania, setKodOpakowania] = useState('TK')
  const [liczbaOpakowan, setLiczbaOpakowan] = useState('')

  function generuj(): string {
    const { date, time } = now()
    const msgId = nextMsgId()
    const journeyTime = `${czasPrzewozuTyp}${czasPrzewozuVal.padStart(2, '0')}`
    const mw = taSamaMiejscWys ? wysylajacy : miejsceWysylki
    const lang = d815bJezyk || 'pl'

    // Buduje blok trader XML (dd815b: dla Consignor/PlaceOfDispatch, ddTypes: dla ConsigneeTrader)
    const tb = (pfx: string, tag: string, t: any) => {
      const dtt = t.id_typ === 'personal' ? '8' : t.id_typ === 'excise' ? '3' : (t.typ || '3')
      const idX = t.id_typ === 'excise'
        ? `<ddTypes:ExciseNumber>${esc(t.id)}</ddTypes:ExciseNumber>`
        : t.id_typ === 'tax'
        ? `<ddTypes:TaxNumber>${esc(t.id)}</ddTypes:TaxNumber>`
        : `<ddTypes:PersonalId>${esc(t.id)}</ddTypes:PersonalId>`
      return `          <${pfx}:${tag} language="${lang}" deliveryTraderType="${dtt}">
            <ddTypes:Traderid>${idX}</ddTypes:Traderid>
            <ddTypes:TraderName>${esc(t.nazwa)}</ddTypes:TraderName>
            <ddTypes:StreetName>${esc(t.ulica)}</ddTypes:StreetName>
            ${t.nr_domu ? `<ddTypes:StreetNumber>${esc(t.nr_domu)}</ddTypes:StreetNumber>` : ''}
            <ddTypes:Postcode>${esc(t.kod)}</ddTypes:Postcode>
            <ddTypes:City>${esc(t.miasto)}</ddTypes:City>
          </${pfx}:${tag}>`
    }

    const consigneeBlocks = odbiorcy.map((o: any) => {
      const delivPlace = o.showMiejsce && o.miejsceOdbioru?.id
        ? tb('ddTypes', 'DeliveryPlaceTrader', o.miejsceOdbioru)
        : tb('ddTypes', 'DeliveryPlaceTrader', o.odbiorca)
      return `          <dd815b:ConsigneeTraders>
${tb('ddTypes', 'ConsigneeTrader', o.odbiorca)}
${delivPlace}
            <ddTypes:DeliveryPlaceCustomsOffice>
              <ddTypes:ReferenceNumber>${esc(o.urzad)}</ddTypes:ReferenceNumber>
            </ddTypes:DeliveryPlaceCustomsOffice>
          </dd815b:ConsigneeTraders>`
    }).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ddEnv:TraderToEDD xmlns:dd815b="${ns.DD815B}" xmlns:ddTypes="${ns.TYPES}" xmlns:ddHeaderType="${ns.HEADER}" xmlns:ddEnv="${ns.ENV}">
  <ddEnv:Message>
    <dd815b:DD815B>
      <dd815b:Header>
        <ddHeaderType:MessageSender>${esc(daneFirmy.nr_akcyzowy)}</ddHeaderType:MessageSender>
        <ddHeaderType:MessageRecipient>NDEA.PL</ddHeaderType:MessageRecipient>
        <ddHeaderType:DateOfPreparation>${date}</ddHeaderType:DateOfPreparation>
        <ddHeaderType:TimeOfPreparation>${time}</ddHeaderType:TimeOfPreparation>
        <ddHeaderType:MessageIdentifier>${esc(msgId)}</ddHeaderType:MessageIdentifier>
      </dd815b:Header>
      <dd815b:Body>
        <dd815b:SubmittedDraftOfEDD>
          <dd815b:DDDraft>
            <dd815b:LocalReferenceNumber>${esc(lrn)}</dd815b:LocalReferenceNumber>
            <dd815b:DeliveryDocumentMode>${tryb || '0'}</dd815b:DeliveryDocumentMode>
            <dd815b:ExciseDutyRate>${stawka}</dd815b:ExciseDutyRate>
            <dd815b:DeferredSubmissionFlag>${odroczony === '1' ? '1' : '0'}</dd815b:DeferredSubmissionFlag>
            ${nrFaktury ? `<dd815b:InvoiceNumber>${esc(nrFaktury)}</dd815b:InvoiceNumber>` : ''}
            <dd815b:InvoiceDate>${dataFaktury}</dd815b:InvoiceDate>
            <dd815b:DateOfDispatch>${dataWysylki}</dd815b:DateOfDispatch>
            <dd815b:TimeOfDispatch>${czasWysylki}</dd815b:TimeOfDispatch>
            <dd815b:JourneyTime>${journeyTime}</dd815b:JourneyTime>
            <dd815b:DeliveryClosingFlag>${trybZamkniecia}</dd815b:DeliveryClosingFlag>
          </dd815b:DDDraft>
${tb('dd815b', 'ConsignorTrader', wysylajacy)}
${tb('dd815b', 'PlaceOfDispatchTrader', mw)}
          <dd815b:PlaceOfDispatchCustomsOffice>
            <ddTypes:ReferenceNumber>${esc(urzadWysylki)}</ddTypes:ReferenceNumber>
          </dd815b:PlaceOfDispatchCustomsOffice>
${consigneeBlocks}
          ${showGwarTransport ? `<dd815b:DDMovementGuarantee>
            <dd815b:GuarantorTypeCode>1</dd815b:GuarantorTypeCode>
            <dd815b:GuaranteeReferenceNumber>${esc(gwarTransportGRN)}</dd815b:GuaranteeReferenceNumber>
            <dd815b:GuaranteeReferenceNumberAccessCode>${esc(gwarTransportKod)}</dd815b:GuaranteeReferenceNumberAccessCode>
            <dd815b:ConsignorTIN>PL${(gwarTransportTIN||FIRMA.nip).toUpperCase().replace(/^PL/,'')}</dd815b:ConsignorTIN>
            <dd815b:GuarantorTIN>PL${(gwarTransportTIN||FIRMA.nip).toUpperCase().replace(/^PL/,'')}</dd815b:GuarantorTIN>
          </dd815b:DDMovementGuarantee>` : ''}
          <dd815b:TransportMode>
            <ddTypes:TransportModeCode>${transportKod}</ddTypes:TransportModeCode>
            ${transportInfo ? `<ddTypes:ComplementaryInformation language="${lang}">${esc(transportInfo)}</ddTypes:ComplementaryInformation>` : ''}
          </dd815b:TransportMode>
          <dd815b:TransportDetails>
            <ddTypes:TransportUnitCode>${jednostkaKod}</ddTypes:TransportUnitCode>
            ${jednostkaOzn ? `<ddTypes:IdentityOfTransportUnits>${esc(jednostkaOzn)}</ddTypes:IdentityOfTransportUnits>` : ''}
            ${transportDodInfo ? `<ddTypes:ComplementaryInformation language="${lang}">${esc(transportDodInfo)}</ddTypes:ComplementaryInformation>` : ''}
          </dd815b:TransportDetails>
          <dd815b:BodyEDD>
            <ddTypes:BodyRecordUniqueReference>1</ddTypes:BodyRecordUniqueReference>
            <ddTypes:ExciseProductCode>${exciseCode}</ddTypes:ExciseProductCode>
            <ddTypes:CnCode>${kodCN}</ddTypes:CnCode>
            <ddTypes:Quantity>${ilosc}</ddTypes:Quantity>
            <ddTypes:GrossWeight>${masaBrutto}</ddTypes:GrossWeight>
            <ddTypes:NetWeight>${masaNetto || String(Math.max(0, Number(masaBrutto) - Number(taraCysterny)))}</ddTypes:NetWeight>
            ${gestosc ? `<ddTypes:Density>${gestosc}</ddTypes:Density>` : ''}
            <ddTypes:Package>
              <ddTypes:KindOfPackages>${kodOpakowania}</ddTypes:KindOfPackages>
              ${liczbaOpakowan ? `<ddTypes:NumberOfPackages>${liczbaOpakowan}</ddTypes:NumberOfPackages>` : ''}
            </ddTypes:Package>
          </dd815b:BodyEDD>
        </dd815b:SubmittedDraftOfEDD>
      </dd815b:Body>
    </dd815b:DD815B>
  </ddEnv:Message>
</ddEnv:TraderToEDD>`
    addHistoria({
      typ: 'DD815B', msgId, lrn, data: new Date().toISOString(), xml,
      odbiorcy: odbiorcy.map((o: any) => ({
        odbiorca: { ...o.odbiorca },
        miejsceOdbioru: { ...o.miejsceOdbioru },
        showMiejsce: o.showMiejsce,
        urzad: o.urzad,
        ilosc: '', dataOdbioru: new Date().toISOString().split('T')[0],
        showExemption: true, exemptionKod: '56', exemptionOpis: 'Cele opałowe',
      })),
      kodCN, exciseCode,
      lrnData: { nrFaktury, dataFaktury, dataWysylki, transportKod, jednostkaKod, jednostkaOzn },
    })
    return xml
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <span className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-lg">DD815B</span>
        <div>
          <p className="text-sm font-medium text-gray-900">Projekt e-DD B — dla LPG i paliwa lotniczego</p>
          <p className="text-xs text-gray-500">Inicjowany przez podmiot wysyłający · Wymagany przed każdą dostawą</p>
        </div>
      </div>

      <Sekcja nr="1" tytul="Nagłówek / Dokument e-DD" kolor="blue">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Pole label="Język dokumentu">
            <select value={d815bJezyk} onChange={e => setD815bJezyk(e.target.value)} className={inputCls}>
              <option value="pl">Polski (pl)</option>
              <option value="en">Angielski (en)</option>
              <option value="de">Niemiecki (de)</option>
              <option value="fr">Francuski (fr)</option>
              <option value="uk">Ukraiński (uk)</option>
            </select>
          </Pole>
          <Pole label="1a LRN — Lokalny nr ref." wymagane
            info="Numer z Twojej ewidencji, unikalny dla przemieszczenia. Format: 11 zn. + A/N/P + 11 cyfr">
            <input value={lrn} onChange={e => setLrn(e.target.value)} maxLength={23} placeholder="np. PL200331000AN00000000001" className={inputCls} />
          </Pole>
          <Pole label="1b Tryb dostawy">
            <select value={tryb} onChange={e => setTryb(e.target.value)} className={inputCls}>
              {TRYBY_DOSTAWY.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Pole>
          <Pole label="1c Stawka akcyzy" wymagane>
            <select value={stawka} onChange={e => setStawka(e.target.value)} className={inputCls}>
              {STAWKI_AKCYZY.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Pole>
          <Pole label="1d Tryb odroczony">
            <select value={odroczony} onChange={e => setOdroczony(e.target.value)} className={inputCls}>
              <option value="0">0 — Tryb standardowy</option>
              <option value="1">1 — Tryb odroczony (awaria systemu)</option>
            </select>
          </Pole>
          <Pole label="1e Nr faktury" wymagane info="Wymagane — puste pole spowoduje błąd walidacji PUESC">
            <input value={nrFaktury} onChange={e => setNrFaktury(e.target.value)} maxLength={35} className={inputCls} />
          </Pole>
          <Pole label="1f Data faktury" wymagane>
            <input type="date" value={dataFaktury} onChange={e => setDataFaktury(e.target.value)} className={inputCls} />
          </Pole>
          <Pole label="1g Data wysyłki" wymagane>
            <input type="date" value={dataWysylki} onChange={e => setDataWysylki(e.target.value)} className={inputCls} />
          </Pole>
          <Pole label="1h Czas wysyłki" wymagane>
            <input type="time" value={czasWysylki} onChange={e => setCzasWysylki(e.target.value + ':00')} className={inputCls} />
          </Pole>
          <Pole label="1i Czas przewozu" wymagane info="H = godziny (max H24), D = dni (max D62 kraj / D92 UE)">
            <div className="flex gap-2">
              <select value={czasPrzewozuTyp} onChange={e => setCzasPrzewozuTyp(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none w-20">
                <option value="H">H (godz.)</option>
                <option value="D">D (dni)</option>
              </select>
              <input type="number" value={czasPrzewozuVal} onChange={e => setCzasPrzewozuVal(e.target.value)} min="1" max={czasPrzewozuTyp === 'H' ? 24 : 62} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none w-20" />
            </div>
          </Pole>
          <Pole label="1j Tryb zamknięcia dostawy" wymagane>
            <select value={trybZamkniecia} onChange={e => setTrybZamkniecia(e.target.value)} className={inputCls}>
              {TRYBY_ZAMKNIECIA.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Pole>
        </div>
      </Sekcja>

      <Sekcja nr="2" tytul="Podmiot wysyłający (pole 2a)" kolor="blue">
        <TraderForm prefix="wys" label="" val={wysylajacy} onChange={setWysylajacy} klienci={klienci} />
      </Sekcja>

      <Sekcja nr="3+4" tytul="Miejsce wysyłki (3a) i Urząd właściwy (4a)" kolor="blue">
        {/* Dane stałe — wyświetlane na szaro, nieedytowalne */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
          <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Dane stałe podmiotu wysyłającego</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-blue-900 md:grid-cols-4">
            <div><span className="text-blue-500 block">Nr akcyzowy</span><strong>{FIRMA.nr_akcyzowy}</strong></div>
            <div><span className="text-blue-500 block">Typ identyfikatora</span><strong>Numer akcyzowy</strong></div>
            <div><span className="text-blue-500 block">Typ podmiotu</span><strong>{FIRMA.typ}</strong></div>
            <div><span className="text-blue-500 block">Kod urzędu</span><strong>{FIRMA.urzad_wysylki}</strong></div>
            <div className="col-span-2 md:col-span-4"><span className="text-blue-500 block">Nazwa podmiotu</span><strong>{FIRMA.nazwa}</strong></div>
          </div>
        </div>
        {/* Edytowalne — tylko adres miejsca wysyłki */}
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Adres miejsca wysyłki (zmienia się per dostawa):</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Pole label="Ulica" wymagane>
            <input value={miejsceWysylki.ulica} onChange={e => setMiejsceWysylki((v:any) => ({ ...v, ulica: e.target.value }))}
              placeholder={FIRMA.miejsce_ulica} className={inputCls} />
          </Pole>
          <Pole label="Nr domu" wymagane>
            <input value={miejsceWysylki.nr_domu} onChange={e => setMiejsceWysylki((v:any) => ({ ...v, nr_domu: e.target.value }))}
              placeholder={FIRMA.miejsce_nr_domu} className={inputCls} />
          </Pole>
          <Pole label="Kod pocztowy" wymagane>
            <input value={miejsceWysylki.kod} onChange={e => setMiejsceWysylki((v:any) => ({ ...v, kod: e.target.value }))}
              placeholder={FIRMA.miejsce_kod} className={inputCls} />
          </Pole>
          <Pole label="Miejscowość" wymagane>
            <input value={miejsceWysylki.miasto} onChange={e => setMiejsceWysylki((v:any) => ({ ...v, miasto: e.target.value }))}
              placeholder={FIRMA.miejsce_miasto} className={inputCls} />
          </Pole>
        </div>
        <button type="button" onClick={() => setMiejsceWysylki((v:any) => ({ ...v,
          ulica: FIRMA.miejsce_ulica, nr_domu: FIRMA.miejsce_nr_domu,
          kod: FIRMA.miejsce_kod, miasto: FIRMA.miejsce_miasto,
        }))} className="mt-2 text-xs text-blue-600 hover:underline">
          ↺ Przywróć domyślny adres ({FIRMA.miejsce_ulica} {FIRMA.miejsce_nr_domu}, {FIRMA.miejsce_miasto})
        </button>
      </Sekcja>

      <Sekcja nr="5" tytul="Podmiot(-y) odbierające (5a)" kolor="green">
        <p className="text-xs text-gray-500 mb-3">DD815B obsługuje wielu odbiorców (np. przy dostawie LPG do kilku klientów).</p>
        {odbiorcy.map((o, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-600">Odbiorca {i + 1}</span>
              {odbiorcy.length > 1 && (
                <button onClick={() => setOdbiorcy(prev => prev.filter((_, j) => j !== i))}
                  className="text-xs text-red-500 hover:text-red-700">Usuń</button>
              )}
            </div>
            <TraderForm prefix={`o${i}`} label="" val={o.odbiorca} klienci={klienci}
              onChange={v => setOdbiorcy(prev => prev.map((x, j) => j === i ? { ...x, odbiorca: v } : x))} />
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" id={`mp${i}`} checked={o.showMiejsce}
                  onChange={e => setOdbiorcy(prev => prev.map((x, j) => j === i ? { ...x, showMiejsce: e.target.checked } : x))} />
                <label htmlFor={`mp${i}`} className="text-xs text-gray-600 cursor-pointer">Miejsce odbioru inne niż podmiot odbierający (sekcja 5.2)</label>
              </div>
              {o.showMiejsce && (
                <TraderForm prefix={`mo${i}`} label="" val={o.miejsceOdbioru}
                  onChange={v => setOdbiorcy(prev => prev.map((x, j) => j === i ? { ...x, miejsceOdbioru: v } : x))} />
              )}
              <div className="mt-2">
                <Pole label="Kod urzędu miejsca odbioru" wymagane info="np. PL402000">
                  <input value={o.urzad} onChange={e => setOdbiorcy(prev => prev.map((x, j) => j === i ? { ...x, urzad: e.target.value } : x))}
                    maxLength={8} placeholder="PL402000" className={inputCls} style={{ maxWidth: 200 }} />
                </Pole>
              </div>
            </div>
          </div>
        ))}
        <button onClick={() => setOdbiorcy(prev => [...prev, { odbiorca: emptyTrader('2'), miejsceOdbioru: emptyTrader('2'), urzad: '', showMiejsce: false }])}
          className="text-xs border border-dashed border-gray-300 rounded-lg px-4 py-2 text-gray-500 hover:border-gray-400 w-full">
          + Dodaj kolejnego odbiorcę
        </button>
      </Sekcja>

      <Sekcja nr="6+7" tytul="Gwarancje (opcjonalne — jeśli wyrób nie jest zwolniony z akcyzy)" kolor="gray">
        <div className="space-y-2">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" id="gwarT" checked={showGwarTransport} onChange={e => setShowGwarTransport(e.target.checked)} />
              <label htmlFor="gwarT" className="text-sm text-gray-600 cursor-pointer">6 — Gwarancja dotycząca transportu (DDMovementGuarantee)</label>
            </div>
            {showGwarTransport && (
              <div className="grid grid-cols-3 gap-3 ml-4">
                <Pole label="Nr GRN (17 zn.)" wymagane>
                  <input value={gwarTransportGRN} onChange={e => setGwarTransportGRN(e.target.value)} maxLength={17} className={inputCls} />
                </Pole>
                <Pole label="Kod dostępu (4 cyfry)" wymagane>
                  <input value={gwarTransportKod} onChange={e => setGwarTransportKod(e.target.value)} maxLength={4} className={inputCls} />
                </Pole>
                <Pole label="TIN podmiotu (PL + NIP)" wymagane>
                  <input value={gwarTransportTIN} onChange={e => setGwarTransportTIN(e.target.value.toUpperCase().replace(/^PL/,""))} maxLength={10} placeholder="6722078718" className={inputCls} />
                </Pole>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" id="gwarM" checked={showGwarMagazyn} onChange={e => setShowGwarMagazyn(e.target.checked)} />
              <label htmlFor="gwarM" className="text-sm text-gray-600 cursor-pointer">7 — Gwarancja na magazynowanie (DDStorageGuarantee)</label>
            </div>
            {showGwarMagazyn && (
              <div className="grid grid-cols-3 gap-3 ml-4">
                <Pole label="Nr GRN (17 zn.)" wymagane>
                  <input value={gwarMagazynGRN} onChange={e => setGwarMagazynGRN(e.target.value)} maxLength={17} className={inputCls} />
                </Pole>
                <Pole label="Kod dostępu (4 cyfry)" wymagane>
                  <input value={gwarMagazynKod} onChange={e => setGwarMagazynKod(e.target.value)} maxLength={4} className={inputCls} />
                </Pole>
                <Pole label="TIN podmiotu (PL + NIP)" wymagane>
                  <input value={gwarMagazynTIN} onChange={e => setGwarMagazynTIN(e.target.value)} maxLength={14} placeholder="PL0000000000" className={inputCls} />
                </Pole>
              </div>
            )}
          </div>
        </div>
      </Sekcja>

      <Sekcja nr="9+10" tytul="Transport — rodzaj i szczegóły (9a, 10a-10c)" kolor="orange">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Pole label="9 Rodzaj transportu" wymagane>
            <select value={transportKod} onChange={e => setTransportKod(e.target.value)} className={inputCls}>
              {RODZAJE_TRANSPORTU.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </Pole>
          <Pole label="10a Kod jednostki transportowej" wymagane>
            <select value={jednostkaKod} onChange={e => setJednostkaKod(e.target.value)} className={inputCls}>
              {KODY_JEDNOSTEK.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </Pole>
          <Pole label="10b Oznaczenie jednostek" info="Nr cysterny, naczepy + ciągnika. Max 35 zn.">
            <input value={jednostkaOzn} onChange={e => setJednostkaOzn(e.target.value)} maxLength={35} placeholder="np. BI12345/BI54321" className={inputCls} />
          </Pole>
          <Pole label="10c Informacje dodatkowe" info="Pieczęcie, plomby. Max 350 zn.">
            <input value={transportDodInfo} onChange={e => setTransportDodInfo(e.target.value)} maxLength={350} placeholder="np. Plomba nr 12345" className={inputCls} />
          </Pole>
          <div className="col-span-2 md:col-span-4">
            <Pole label="Informacje o transporcie (opis)" info="Max 350 zn.">
              <input value={transportInfo} onChange={e => setTransportInfo(e.target.value)} maxLength={350} className={inputCls} />
            </Pole>
          </div>
        </div>
      </Sekcja>

      <Sekcja nr="11" tytul="Wyrób akcyzowy — kod CN, ilość, masy, opakowanie" kolor="red">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Pole label="11c Kod CN wyrobu" wymagane info="8 cyfr">
            <select value={kodCN} onChange={e => {
              const k = KODY_CN.find(x => x.v === e.target.value)
              setKodCN(e.target.value)
              if (k) setExciseCode(k.e)
            }} className={inputCls}>
              {KODY_CN.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </Pole>
          <Pole label="Kod wyrobu akcyzowego" wymagane info="ExciseProductCode (4 zn.)">
            <input value={exciseCode} onChange={e => setExciseCode(e.target.value)} maxLength={4} className={inputCls} />
          </Pole>
          <Pole label="11d Ilość" wymagane info="Liczba całkowita (litry lub kg bez ułamków)">
            <input type="number" value={ilosc} onChange={e => setIlosc(e.target.value)} min="1" className={inputCls} />
          </Pole>
          <div></div>
          <Pole label="11e Masa brutto [kg]" wymagane info="Wyrób + pojazd (cysterna). Liczba całkowita.">
            <input type="number" value={masaBrutto} onChange={e => setMasaBrutto(e.target.value)} min="1" className={inputCls} />
          </Pole>
          <Pole label="11f Masa netto [kg]" wymagane info="Wyrób bez pojazdu. Liczba całkowita.">
            <input type="number" value={masaNetto} onChange={e => setMasaNetto(e.target.value)} min="1" className={inputCls} />
          </Pole>
          {/* Kalkulator: Masa brutto → netto */}
          <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs font-medium text-blue-800 mb-2">🧮 Kalkulator masy: Netto = Brutto − Tara</p>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-xs text-blue-700 block mb-1">Tara cysterny [kg]</label>
                <input type="number" value={taraCysterny} onChange={e => { setTaraCysterny(e.target.value); if(masaBrutto) setMasaNetto(String(Math.max(0,Number(masaBrutto)-Number(e.target.value)))) }} placeholder="np. 14000" className={inputCls} />
              </div>
              <div><label className="text-xs text-blue-700 block mb-1">= Masa netto [kg]</label>
                <input readOnly value={taraCysterny&&masaBrutto?String(Math.max(0,Number(masaBrutto)-Number(taraCysterny))):masaNetto} className={inputCls + ' bg-blue-100'} />
              </div>
            </div>
          </div>
          <Pole label="Kod opakowania" wymagane>
            <select value={kodOpakowania} onChange={e => setKodOpakowania(e.target.value)} className={inputCls}>
              {KODY_OPAKOWAN.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </Pole>
          <Pole label="Liczba opakowań">
            <input type="number" value={liczbaOpakowan} onChange={e => setLiczbaOpakowan(e.target.value)} min="0" className={inputCls} />
          </Pole>
        </div>
      </Sekcja>

      <Akcje
        typ="DD815B"
        onPodglad={() => { const x = generuj(); setXmlPodglad(x); setShowXML(true) }}
        onPobierz={() => { const x = generuj(); pobierzXML(x, `DD815B_${lrn || 'draft'}.xml`); setSukces('Plik pobrany!'); setTimeout(() => setSukces(''), 2000) }}
        onKopiuj={() => { const x = generuj(); kopiujXML(x) }}
      />
      <p className="text-xs text-gray-400 mt-2">Prześlij na: <span className="font-mono">emcs.hd@ncts-centrum.mofnet.gov.pl</span> lub przez portal PUESC · 1 komunikat = 1 e-mail</p>
    </div>
  )
}

// ============================================================
// ===== DD810 — Anulowanie e-DD =====
// ============================================================
function FormDD810({ daneFirmy, nextMsgId, addHistoria, pobierzXML, kopiujXML, setXmlPodglad, setShowXML, setSukces, nsVersion = '2025/03' }: any) {
  const ns = buildNs(nsVersion)
  const [arc, setArc] = useState('')
  const [przyczyna, setPrzyczyna] = useState('0')
  const [info, setInfo] = useState('')

  function generuj(): string {
    const { date, time } = now()
    const msgId = nextMsgId()
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ddEnv:TraderToEDD xmlns:dd810="${ns.DD810}" xmlns:ddTypes="${ns.TYPES}" xmlns:ddHeaderType="${ns.HEADER}" xmlns:ddEnv="${ns.ENV}">
  <Header>
    <MessageSender>${esc(daneFirmy.nr_akcyzowy)}</MessageSender>
    <MessageRecipient>EMCSPL2</MessageRecipient>
    <DateOfPreparation>${date}</DateOfPreparation>
    <TimeOfPreparation>${time}</TimeOfPreparation>
    <MessageIdentifier>${esc(msgId)}</MessageIdentifier>
  </Header>
  <Body>
    <CancellationOfEDD>
      <DeliveryDocumentAdministrativeReferenceCode>${esc(arc)}</DeliveryDocumentAdministrativeReferenceCode>
      <Cancellation>
        <CancellationReasonCode>${przyczyna}</CancellationReasonCode>
        ${info ? `<ComplementaryInformation language="pl">${esc(info)}</ComplementaryInformation>` : ''}
      </Cancellation>
    </CancellationOfEDD>
      </dd810:Body>
    </dd810:DD810>
  </ddEnv:Message>
</ddEnv:TraderToEDD>`
    addHistoria({ typ: 'DD810', msgId, arc, data: new Date().toISOString(), xml })
    return xml
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <span className="bg-red-100 text-red-800 text-sm font-bold px-3 py-1 rounded-lg">DD810</span>
        <div>
          <p className="text-sm font-medium text-gray-900">Anulowanie e-DD</p>
          <p className="text-xs text-gray-500">Możliwe tylko gdy wyroby nie opuściły miejsca wysyłki · Po DD813 anulowanie jest niemożliwe</p>
        </div>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-yellow-800">⚠ Anulowanie e-DD nie może być wykonane po fizycznym opuszczeniu miejsca wysyłki przez wyroby. Po wysłaniu DD813 anulowanie jest niemożliwe.</p>
      </div>

      <Sekcja nr="1" tytul="Anulowanie e-DD" kolor="red">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Pole label="1a Nr ARC dokumentu e-DD" wymagane
            info="Format: 2 cyfry roku + 2 lit. kraju + DD + 14 zn. + 1 cyfra, łącznie 21 znaków. Np. 25PLDD00000000000000001">
            <input value={arc} onChange={e => setArc(e.target.value.toUpperCase())} maxLength={21}
              placeholder="25PLDD00000000000000001" className={inputCls + ' font-mono'} />
            {arc && arc.length === 21 && !/^[0-9]{2}[A-Z]{2}DD[A-Z0-9]{14}[0-9]$/.test(arc) && (
              <p className="text-xs text-red-600">Niepoprawny format ARC</p>
            )}
          </Pole>
          <Pole label="1a Kod przyczyny anulowania" wymagane>
            <select value={przyczyna} onChange={e => setPrzyczyna(e.target.value)} className={inputCls}>
              {PRZYCZYNY_ANULOWANIA.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
          </Pole>
          <Pole label="Uzasadnienie / opis" info="Opcjonalne, max 350 zn.">
            <input value={info} onChange={e => setInfo(e.target.value)} maxLength={350} className={inputCls} />
          </Pole>
        </div>
      </Sekcja>

      <Akcje typ="DD810"
        onPodglad={() => { const x = generuj(); setXmlPodglad(x); setShowXML(true) }}
        onPobierz={() => { const x = generuj(); pobierzXML(x, `DD810_${arc || 'draft'}.xml`); setSukces('Plik pobrany!'); setTimeout(() => setSukces(''), 2000) }}
        onKopiuj={() => kopiujXML(generuj())}
      />
    </div>
  )
}

// ============================================================
// ===== DD813 — Zmiana miejsca przeznaczenia =====
// ============================================================
function FormDD813({ daneFirmy, nextMsgId, addHistoria, pobierzXML, kopiujXML, setXmlPodglad, setShowXML, setSukces, nsVersion = '2025/03' }: any) {
  const ns = buildNs(nsVersion)
  const [arc, setArc] = useState('')
  const [seqNr, setSeqNr] = useState('1')
  const [czasPrzewozuTyp, setCzasPrzewozuTyp] = useState('H')
  const [czasPrzewozuVal, setCzasPrzewozuVal] = useState('04')
  const [dataFaktury, setDataFaktury] = useState('')
  const [nrFaktury, setNrFaktury] = useState('')
  const [transportKod, setTransportKod] = useState('3')
  const [trybZamkniecia, setTrybZamkniecia] = useState('1')
  const [nowyOdbiorca, setNowyOdbiorca] = useState(emptyTrader('2'))
  const [showMiejsce, setShowMiejsce] = useState(false)
  const [miejsceOdbioru, setMiejsceOdbioru] = useState(emptyTrader('2'))
  const [urzadOdbioru, setUrzadOdbioru] = useState('')
  const [showTransport, setShowTransport] = useState(false)
  const [jednostkaKod, setJednostkaKod] = useState('2')
  const [jednostkaOzn, setJednostkaOzn] = useState('')
  const [transportDodInfo, setTransportDodInfo] = useState('')

  function generuj(): string {
    const { date, time } = now()
    const msgId = nextMsgId()
    const journeyTime = `${czasPrzewozuTyp}${czasPrzewozuVal.padStart(2, '0')}`
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DD813 xmlns="${ns.DD813}">
  <Header>
    <MessageSender>${esc(daneFirmy.nr_akcyzowy)}</MessageSender>
    <MessageRecipient>EMCSPL2</MessageRecipient>
    <DateOfPreparation>${date}</DateOfPreparation>
    <TimeOfPreparation>${time}</TimeOfPreparation>
    <MessageIdentifier>${esc(msgId)}</MessageIdentifier>
  </Header>
  <Body>
    <ChangeOfDestination>
      <UpdateEDD>
        <DocumentReference>
          <DeliveryDocumentAdministrativeReferenceCode>${esc(arc)}</DeliveryDocumentAdministrativeReferenceCode>
          <SequenceNumber>${seqNr}</SequenceNumber>
        </DocumentReference>
        ${czasPrzewozuVal ? `<JourneyTime>${journeyTime}</JourneyTime>` : ''}
        ${dataFaktury ? `<InvoiceDate>${dataFaktury}</InvoiceDate>` : ''}
        ${nrFaktury ? `<InvoiceNumber>${esc(nrFaktury)}</InvoiceNumber>` : ''}
        <TransportMode>
          <TransportModeCode>${transportKod}</TransportModeCode>
        </TransportMode>
        <DeliveryClosingFlag>${trybZamkniecia}</DeliveryClosingFlag>
      </UpdateEDD>
      <DestinationChanged>
        ${traderXml('NewConsigneeTrader', nowyOdbiorca)}
        ${showMiejsce ? traderXml('DeliveryPlaceTrader', miejsceOdbioru) : ''}
        ${officeXml('DeliveryPlaceCustomsOffice', urzadOdbioru)}
      </DestinationChanged>
      ${showTransport ? `
      <TransportDetails>
        <TransportUnitCode>${jednostkaKod}</TransportUnitCode>
        ${jednostkaOzn ? `<IdentityOfTransportUnits>${esc(jednostkaOzn)}</IdentityOfTransportUnits>` : ''}
        ${transportDodInfo ? `<ComplementaryInformation language="pl">${esc(transportDodInfo)}</ComplementaryInformation>` : ''}
      </TransportDetails>` : ''}
    </ChangeOfDestination>
  </Body>
</DD813>`
    addHistoria({ typ: 'DD813', msgId, arc, data: new Date().toISOString(), xml })
    return xml
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <span className="bg-yellow-100 text-yellow-800 text-sm font-bold px-3 py-1 rounded-lg">DD813</span>
        <div>
          <p className="text-sm font-medium text-gray-900">Zmiana miejsca przeznaczenia</p>
          <p className="text-xs text-gray-500">Wysyłany przez podmiot wysyłający · Po DD813 anulowanie (DD810) jest niemożliwe</p>
        </div>
      </div>

      <Sekcja nr="1" tytul="Uzupełnienie dokumentu e-DD" kolor="orange">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Pole label="1a Nr ARC" wymagane info="21 znaków">
            <input value={arc} onChange={e => setArc(e.target.value.toUpperCase())} maxLength={21}
              placeholder="25PLDD00000000000000001" className={inputCls + ' font-mono'} />
          </Pole>
          <Pole label="1b Nr porządkowy" wymagane info="Przy 1. zatwierdzeniu=1, po każdej zmianie +1">
            <input type="number" value={seqNr} onChange={e => setSeqNr(e.target.value)} min="1" max="99" className={inputCls} />
          </Pole>
          <Pole label="1c Czas przewozu" info="Jeśli zmienia się w związku ze zmianą">
            <div className="flex gap-2">
              <select value={czasPrzewozuTyp} onChange={e => setCzasPrzewozuTyp(e.target.value)} className="px-2 py-2 border border-gray-200 rounded-lg text-sm w-20">
                <option value="H">H (godz.)</option>
                <option value="D">D (dni)</option>
              </select>
              <input type="number" value={czasPrzewozuVal} onChange={e => setCzasPrzewozuVal(e.target.value)} min="1" max={czasPrzewozuTyp === 'H' ? 24 : 62} className="px-2 py-2 border border-gray-200 rounded-lg text-sm w-20" />
            </div>
          </Pole>
          <Pole label="1f Kod rodzaju transportu" wymagane>
            <select value={transportKod} onChange={e => setTransportKod(e.target.value)} className={inputCls}>
              {RODZAJE_TRANSPORTU.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </Pole>
          <Pole label="1d Data faktury" info="Jeśli zmienia się">
            <input type="date" value={dataFaktury} onChange={e => setDataFaktury(e.target.value)} className={inputCls} />
          </Pole>
          <Pole label="1e Nr faktury" info="Jeśli zmienia się, max 35 zn.">
            <input value={nrFaktury} onChange={e => setNrFaktury(e.target.value)} maxLength={35} className={inputCls} />
          </Pole>
          <Pole label="1g Tryb zakończenia dostawy" wymagane>
            <select value={trybZamkniecia} onChange={e => setTrybZamkniecia(e.target.value)} className={inputCls}>
              {TRYBY_ZAMKNIECIA.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Pole>
        </div>
      </Sekcja>

      <Sekcja nr="2" tytul="Nowy podmiot odbierający (2a-2h)" kolor="green">
        <p className="text-xs text-gray-500 mb-3">Wymagane jeśli odbiorca zmienia się. Wypełnij jeśli dotyczy.</p>
        <TraderForm prefix="no" label="" val={nowyOdbiorca} onChange={setNowyOdbiorca} />
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <input type="checkbox" id="mpDD813" checked={showMiejsce} onChange={e => setShowMiejsce(e.target.checked)} />
            <label htmlFor="mpDD813" className="text-xs text-gray-600 cursor-pointer">2.2 Miejsce odbioru różne od nowego odbiorcy</label>
          </div>
          {showMiejsce && <TraderForm prefix="mo" label="" val={miejsceOdbioru} onChange={setMiejsceOdbioru} />}
        </div>
        <div className="mt-3">
          <Pole label="2.3a Nr ref. urzędu miejsca odbioru" wymagane info="np. PL402000">
            <input value={urzadOdbioru} onChange={e => setUrzadOdbioru(e.target.value)} maxLength={8} className={inputCls} style={{ maxWidth: 200 }} />
          </Pole>
        </div>
      </Sekcja>

      <Sekcja nr="3" tytul="Szczegóły transportu (jeśli zmienia się)" kolor="orange">
        <div className="flex items-center gap-2 mb-3">
          <input type="checkbox" id="showTr" checked={showTransport} onChange={e => setShowTransport(e.target.checked)} />
          <label htmlFor="showTr" className="text-sm text-gray-600 cursor-pointer">Transport ulega zmianie w związku ze zmianą miejsca przeznaczenia</label>
        </div>
        {showTransport && (
          <div className="grid grid-cols-3 gap-3">
            <Pole label="3a Kod jednostki transportowej">
              <select value={jednostkaKod} onChange={e => setJednostkaKod(e.target.value)} className={inputCls}>
                {KODY_JEDNOSTEK.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
              </select>
            </Pole>
            <Pole label="3b Oznaczenie jednostek" info="Max 35 zn.">
              <input value={jednostkaOzn} onChange={e => setJednostkaOzn(e.target.value)} maxLength={35} className={inputCls} />
            </Pole>
            <Pole label="3c Informacje dodatkowe" info="Max 350 zn.">
              <input value={transportDodInfo} onChange={e => setTransportDodInfo(e.target.value)} maxLength={350} className={inputCls} />
            </Pole>
          </div>
        )}
      </Sekcja>

      <Akcje typ="DD813"
        onPodglad={() => { const x = generuj(); setXmlPodglad(x); setShowXML(true) }}
        onPobierz={() => { const x = generuj(); pobierzXML(x, `DD813_${arc || 'draft'}.xml`); setSukces('Plik pobrany!'); setTimeout(() => setSukces(''), 2000) }}
        onKopiuj={() => kopiujXML(generuj())}
      />
    </div>
  )
}

// ============================================================
// ===== DD813B — Zmiana miejsca przeznaczenia (zbiorczy) =====
// ============================================================
function FormDD813B({ daneFirmy, nextMsgId, addHistoria, pobierzXML, kopiujXML, setXmlPodglad, setShowXML, setSukces, nsVersion = '2025/03' }: any) {
  const ns = buildNs(nsVersion)
  // Identyczne pola jak DD813 ale sekcja 2 może wystąpić wielokrotnie
  const [arc, setArc] = useState('')
  const [seqNr, setSeqNr] = useState('1')
  const [transportKod, setTransportKod] = useState('3')
  const [trybZamkniecia, setTrybZamkniecia] = useState('1')
  const [odbiorcy, setOdbiorcy] = useState([{
    odbiorca: emptyTrader('2'), miejsceOdbioru: emptyTrader('2'), urzad: '', showMiejsce: false,
  }])

  function generuj(): string {
    const { date, time } = now()
    const msgId = nextMsgId()
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DD813B xmlns="${ns.DD813B}">
  <Header>
    <MessageSender>${esc(daneFirmy.nr_akcyzowy)}</MessageSender>
    <MessageRecipient>EMCSPL2</MessageRecipient>
    <DateOfPreparation>${date}</DateOfPreparation>
    <TimeOfPreparation>${time}</TimeOfPreparation>
    <MessageIdentifier>${esc(msgId)}</MessageIdentifier>
  </Header>
  <Body>
    <ChangeOfDestination>
      <UpdateEDD>
        <DocumentReference>
          <DeliveryDocumentAdministrativeReferenceCode>${esc(arc)}</DeliveryDocumentAdministrativeReferenceCode>
          <SequenceNumber>${seqNr}</SequenceNumber>
        </DocumentReference>
        <TransportMode><TransportModeCode>${transportKod}</TransportModeCode></TransportMode>
        <DeliveryClosingFlag>${trybZamkniecia}</DeliveryClosingFlag>
      </UpdateEDD>
      ${odbiorcy.map(o => `
      <DestinationChanged>
        ${traderXml('NewConsigneeTrader', o.odbiorca)}
        ${o.showMiejsce ? traderXml('DeliveryPlaceTrader', o.miejsceOdbioru) : ''}
        ${officeXml('DeliveryPlaceCustomsOffice', o.urzad)}
      </DestinationChanged>`).join('')}
    </ChangeOfDestination>
  </Body>
</DD813B>`
    addHistoria({ typ: 'DD813B', msgId, arc, data: new Date().toISOString(), xml })
    return xml
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <span className="bg-yellow-100 text-yellow-800 text-sm font-bold px-3 py-1 rounded-lg">DD813B</span>
        <div>
          <p className="text-sm font-medium text-gray-900">Zmiana miejsca przeznaczenia (zbiorczy)</p>
          <p className="text-xs text-gray-500">Dla LPG z wieloma odbiorcami — sekcja 2 może wystąpić wielokrotnie</p>
        </div>
      </div>

      <Sekcja nr="1" tytul="Identyfikacja i transport" kolor="orange">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Pole label="1a Nr ARC" wymagane>
            <input value={arc} onChange={e => setArc(e.target.value.toUpperCase())} maxLength={21} className={inputCls + ' font-mono'} />
          </Pole>
          <Pole label="1b Nr porządkowy" wymagane>
            <input type="number" value={seqNr} onChange={e => setSeqNr(e.target.value)} min="1" max="99" className={inputCls} />
          </Pole>
          <Pole label="1f Kod transportu" wymagane>
            <select value={transportKod} onChange={e => setTransportKod(e.target.value)} className={inputCls}>
              {RODZAJE_TRANSPORTU.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </Pole>
          <Pole label="1g Tryb zamknięcia" wymagane>
            <select value={trybZamkniecia} onChange={e => setTrybZamkniecia(e.target.value)} className={inputCls}>
              {TRYBY_ZAMKNIECIA.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Pole>
        </div>
      </Sekcja>

      <Sekcja nr="2" tytul="Nowi odbiorcy (sekcja 2 — wielokrotna)" kolor="green">
        {odbiorcy.map((o, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600">Odbiorca {i + 1}</span>
              {odbiorcy.length > 1 && <button onClick={() => setOdbiorcy(p => p.filter((_, j) => j !== i))} className="text-xs text-red-500">Usuń</button>}
            </div>
            <TraderForm prefix={`o${i}`} label="" val={o.odbiorca}
              onChange={v => setOdbiorcy(p => p.map((x, j) => j === i ? { ...x, odbiorca: v } : x))} />
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-1">
                <input type="checkbox" checked={o.showMiejsce}
                  onChange={e => setOdbiorcy(p => p.map((x, j) => j === i ? { ...x, showMiejsce: e.target.checked } : x))} />
                <span className="text-xs text-gray-500">2.2 Miejsce odbioru różne</span>
              </div>
              {o.showMiejsce && <TraderForm prefix={`mo${i}`} label="" val={o.miejsceOdbioru}
                onChange={v => setOdbiorcy(p => p.map((x, j) => j === i ? { ...x, miejsceOdbioru: v } : x))} />}
              <Pole label="2.3a Urząd odbioru" wymagane>
                <input value={o.urzad} onChange={e => setOdbiorcy(p => p.map((x, j) => j === i ? { ...x, urzad: e.target.value } : x))}
                  maxLength={8} className={inputCls} style={{ maxWidth: 180 }} />
              </Pole>
            </div>
          </div>
        ))}
        <button onClick={() => setOdbiorcy(p => [...p, { odbiorca: emptyTrader('2'), miejsceOdbioru: emptyTrader('2'), urzad: '', showMiejsce: false }])}
          className="text-xs border border-dashed border-gray-300 rounded-lg px-4 py-2 text-gray-500 hover:border-gray-400 w-full">+ Dodaj odbiorcę</button>
      </Sekcja>

      <Akcje typ="DD813B"
        onPodglad={() => { const x = generuj(); setXmlPodglad(x); setShowXML(true) }}
        onPobierz={() => { const x = generuj(); pobierzXML(x, `DD813B_${arc || 'draft'}.xml`); setSukces('Plik pobrany!'); setTimeout(() => setSukces(''), 2000) }}
        onKopiuj={() => kopiujXML(generuj())}
      />
    </div>
  )
}

// ============================================================
// ===== DD812 — Powiadomienie o przeładunku =====
// ============================================================
function FormDD812({ daneFirmy, nextMsgId, addHistoria, pobierzXML, kopiujXML, setXmlPodglad, setShowXML, setSukces, nsVersion = '2025/03' }: any) {
  const ns = buildNs(nsVersion)
  const [arc, setArc] = useState('')
  const [seqNr, setSeqNr] = useState('1')
  const [urzadPrzeladunku, setUrzadPrzeladunku] = useState('')
  const [dataPrzeladunku, setDataPrzeladunku] = useState(new Date().toISOString().split('T')[0])
  const [czasPrzeladunku, setCzasPrzeladunku] = useState('10:00:00')
  const [dodInfo, setDodInfo] = useState('')
  const [transportKod, setTransportKod] = useState('3')
  const [nazwaMiejsca, setNazwaMiejsca] = useState('')
  const [ulica, setUlica] = useState('')
  const [kod, setKod] = useState('')
  const [miasto, setMiasto] = useState('')
  const [showTransport, setShowTransport] = useState(false)
  const [jednostkaKod, setJednostkaKod] = useState('2')
  const [jednostkaOzn, setJednostkaOzn] = useState('')

  function generuj(): string {
    const { date, time } = now()
    const msgId = nextMsgId()
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ddEnv:TraderToEDD xmlns:dd812="${ns.DD812}" xmlns:ddTypes="${ns.TYPES}" xmlns:ddHeaderType="${ns.HEADER}" xmlns:ddEnv="${ns.ENV}">
  <Header>
    <MessageSender>${esc(daneFirmy.nr_akcyzowy)}</MessageSender>
    <MessageRecipient>EMCSPL2</MessageRecipient>
    <DateOfPreparation>${date}</DateOfPreparation>
    <TimeOfPreparation>${time}</TimeOfPreparation>
    <MessageIdentifier>${esc(msgId)}</MessageIdentifier>
  </Header>
  <Body>
    <ReloadingOfDeliveryDocument>
      <DocumentReference>
        <DeliveryDocumentAdministrativeReferenceCode>${esc(arc)}</DeliveryDocumentAdministrativeReferenceCode>
        <SequenceNumber>${seqNr}</SequenceNumber>
      </DocumentReference>
      <Reloading>
        <PlaceOfReloadingOffice><ReferenceNumber>${esc(urzadPrzeladunku)}</ReferenceNumber></PlaceOfReloadingOffice>
        <DateAndTimeOfPlannedReloading>${dataPrzeladunku}T${czasPrzeladunku}</DateAndTimeOfPlannedReloading>
        ${dodInfo ? `<ComplementaryInformation language="pl">${esc(dodInfo)}</ComplementaryInformation>` : ''}
        ${transportKod !== '3' ? `<TransportModeCode>${transportKod}</TransportModeCode>` : ''}
        <PlaceOfReloading>
          <PlaceName>${esc(nazwaMiejsca)}</PlaceName>
          <StreetName>${esc(ulica)}</StreetName>
          <Postcode>${esc(kod)}</Postcode>
          <City>${esc(miasto)}</City>
        </PlaceOfReloading>
      </Reloading>
      ${showTransport ? `
      <TransportDetails>
        <TransportUnitCode>${jednostkaKod}</TransportUnitCode>
        ${jednostkaOzn ? `<IdentityOfTransportUnits>${esc(jednostkaOzn)}</IdentityOfTransportUnits>` : ''}
      </TransportDetails>` : ''}
    </ReloadingOfDeliveryDocument>
      </dd812:Body>
    </dd812:DD812>
  </ddEnv:Message>
</ddEnv:TraderToEDD>`
    addHistoria({ typ: 'DD812', msgId, arc, data: new Date().toISOString(), xml })
    return xml
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <span className="bg-orange-100 text-orange-800 text-sm font-bold px-3 py-1 rounded-lg">DD812</span>
        <div>
          <p className="text-sm font-medium text-gray-900">Powiadomienie o przeładunku wyrobów e-DD</p>
          <p className="text-xs text-gray-500">Wysyłany gdy wyroby są przeładowywane w trakcie transportu</p>
        </div>
      </div>

      <Sekcja nr="1" tytul="Identyfikacja e-DD" kolor="orange">
        <div className="grid grid-cols-2 gap-3">
          <Pole label="1a Nr ARC" wymagane>
            <input value={arc} onChange={e => setArc(e.target.value.toUpperCase())} maxLength={21} className={inputCls + ' font-mono'} />
          </Pole>
          <Pole label="1b Nr porządkowy" wymagane>
            <input type="number" value={seqNr} onChange={e => setSeqNr(e.target.value)} min="1" className={inputCls} />
          </Pole>
        </div>
      </Sekcja>

      <Sekcja nr="2" tytul="Szczegóły przeładunku" kolor="orange">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Pole label="2a Nr ref. urzędu w miejscu przeładunku" wymagane>
            <input value={urzadPrzeladunku} onChange={e => setUrzadPrzeladunku(e.target.value)} maxLength={8} className={inputCls} />
          </Pole>
          <Pole label="2b Data planowanego przeładunku" wymagane>
            <input type="date" value={dataPrzeladunku} onChange={e => setDataPrzeladunku(e.target.value)} className={inputCls} />
          </Pole>
          <Pole label="Czas przeładunku" wymagane>
            <input type="time" value={czasPrzeladunku} onChange={e => setCzasPrzeladunku(e.target.value + ':00')} className={inputCls} />
          </Pole>
          <Pole label="2d Kod transportu po przeładunku">
            <select value={transportKod} onChange={e => setTransportKod(e.target.value)} className={inputCls}>
              {RODZAJE_TRANSPORTU.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </Pole>
          <Pole label="2c Informacje dodatkowe" info="Max 350 zn.">
            <input value={dodInfo} onChange={e => setDodInfo(e.target.value)} maxLength={350} className={inputCls} />
          </Pole>
        </div>
        <div className="mt-3">
          <p className="text-xs font-bold text-gray-600 mb-2">2.1 Miejsce przeładunku</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Pole label="2.1a Nazwa miejsca" wymagane>
              <input value={nazwaMiejsca} onChange={e => setNazwaMiejsca(e.target.value)} maxLength={182} className={inputCls} />
            </Pole>
            <Pole label="2.1b Ulica" wymagane>
              <input value={ulica} onChange={e => setUlica(e.target.value)} maxLength={65} className={inputCls} />
            </Pole>
            <Pole label="2.1d Kod pocztowy" wymagane>
              <input value={kod} onChange={e => setKod(e.target.value)} maxLength={10} className={inputCls} />
            </Pole>
            <Pole label="2.1e Miejscowość" wymagane>
              <input value={miasto} onChange={e => setMiasto(e.target.value)} maxLength={50} className={inputCls} />
            </Pole>
          </div>
        </div>
      </Sekcja>

      <Sekcja nr="3" tytul="Szczegóły transportu po przeładunku (jeśli zmienia się)" kolor="orange">
        <div className="flex items-center gap-2 mb-3">
          <input type="checkbox" checked={showTransport} onChange={e => setShowTransport(e.target.checked)} id="showTrDD812" />
          <label htmlFor="showTrDD812" className="text-sm text-gray-600 cursor-pointer">Transport zmienia się po przeładunku</label>
        </div>
        {showTransport && (
          <div className="grid grid-cols-2 gap-3">
            <Pole label="3a Kod jednostki">
              <select value={jednostkaKod} onChange={e => setJednostkaKod(e.target.value)} className={inputCls}>
                {KODY_JEDNOSTEK.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
              </select>
            </Pole>
            <Pole label="3b Oznaczenie jednostek">
              <input value={jednostkaOzn} onChange={e => setJednostkaOzn(e.target.value)} maxLength={35} className={inputCls} />
            </Pole>
          </div>
        )}
      </Sekcja>

      <Akcje typ="DD812"
        onPodglad={() => { const x = generuj(); setXmlPodglad(x); setShowXML(true) }}
        onPobierz={() => { const x = generuj(); pobierzXML(x, `DD812_${arc || 'draft'}.xml`); setSukces('Plik pobrany!'); setTimeout(() => setSukces(''), 2000) }}
        onKopiuj={() => kopiujXML(generuj())}
      />
    </div>
  )
}

// ============================================================
// ===== DD817 — Powiadomienie o przybyciu wyrobów =====
// ============================================================
function FormDD817({ daneFirmy, nextMsgId, addHistoria, pobierzXML, kopiujXML, setXmlPodglad, setShowXML, setSukces, nsVersion = '2025/03' }: any) {
  const ns = buildNs(nsVersion)
  const [arc, setArc] = useState('')
  const [seqNr, setSeqNr] = useState('1')
  const [dataGodzPrzybycia, setDataGodzPrzybycia] = useState(new Date().toISOString().split('T')[0])
  const [czasPrzybycia, setCzasPrzybycia] = useState('10:00:00')
  const [naruszonePlomby, setNaruszonePlomby] = useState('0')
  const [infoPrzybycie, setInfoPrzybycie] = useState('')
  // Sekcja 3 - Podmiot odbierający (wymagany wg HTML)
  const [odbiorca, setOdbiorca] = useState(emptyTrader('2'))
  // Sekcja 4 - Miejsce odbioru (jeśli różne)
  const [showMiejsce, setShowMiejsce] = useState(false)
  const [miejsceOdbioru, setMiejsceOdbioru] = useState(emptyTrader('2'))
  // Sekcja 5 - Urząd
  const [urzad, setUrzad] = useState('')

  function generuj(): string {
    const { date, time } = now()
    const msgId = nextMsgId()
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ddEnv:TraderToEDD xmlns:dd817="${ns.DD817}" xmlns:ddTypes="${ns.TYPES}" xmlns:ddHeaderType="${ns.HEADER}" xmlns:ddEnv="${ns.ENV}">
  <Header>
    <MessageSender>${esc(daneFirmy.nr_akcyzowy)}</MessageSender>
    <MessageRecipient>EMCSPL2</MessageRecipient>
    <DateOfPreparation>${date}</DateOfPreparation>
    <TimeOfPreparation>${time}</TimeOfPreparation>
    <MessageIdentifier>${esc(msgId)}</MessageIdentifier>
  </Header>
  <Body>
    <DeliveryNotificationForDeliveryDocument>
      <DocumentReference>
        <DeliveryDocumentAdministrativeReferenceCode>${esc(arc)}</DeliveryDocumentAdministrativeReferenceCode>
        <SequenceNumber>${seqNr}</SequenceNumber>
      </DocumentReference>
      ${traderXml('ConsigneeTrader', odbiorca)}
      ${showMiejsce ? traderXml('PlaceOfDeliveryTrader', miejsceOdbioru) : ''}
      ${officeXml('PlaceOfDeliveryCustomsOffice', urzad)}
      <DeliveryNotification>
        <DateAndTimeOfDelivery>${dataGodzPrzybycia}T${czasPrzybycia}</DateAndTimeOfDelivery>
        ${infoPrzybycie ? `<DeliveryInformation language="pl">${esc(infoPrzybycie)}</DeliveryInformation>` : ''}
        <SealCompromised>${naruszonePlomby}</SealCompromised>
      </DeliveryNotification>
    </DeliveryNotificationForDeliveryDocument>
      </dd817:Body>
    </dd817:DD817>
  </ddEnv:Message>
</ddEnv:TraderToEDD>`
    addHistoria({ typ: 'DD817', msgId, arc, data: new Date().toISOString(), xml })
    return xml
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <span className="bg-purple-100 text-purple-800 text-sm font-bold px-3 py-1 rounded-lg">DD817</span>
        <div>
          <p className="text-sm font-medium text-gray-900">Powiadomienie o przybyciu wyrobów</p>
          <p className="text-xs text-gray-500">Inicjowany przez podmiot odbierający · Przed wysłaniem DD818</p>
        </div>
      </div>

      <Sekcja nr="1" tytul="Dokument e-DD" kolor="purple">
        <div className="grid grid-cols-2 gap-3">
          <Pole label="1a Nr ARC" wymagane>
            <input value={arc} onChange={e => setArc(e.target.value.toUpperCase())} maxLength={21} className={inputCls + ' font-mono'} />
          </Pole>
          <Pole label="1b Nr porządkowy" wymagane>
            <input type="number" value={seqNr} onChange={e => setSeqNr(e.target.value)} min="1" className={inputCls} />
          </Pole>
        </div>
      </Sekcja>

      <Sekcja nr="2" tytul="Przybycie wyrobów" kolor="purple">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Pole label="2a Data przybycia" wymagane>
            <input type="date" value={dataGodzPrzybycia} onChange={e => setDataGodzPrzybycia(e.target.value)} className={inputCls} />
          </Pole>
          <Pole label="2a Czas przybycia" wymagane>
            <input type="time" value={czasPrzybycia} onChange={e => setCzasPrzybycia(e.target.value + ':00')} className={inputCls} />
          </Pole>
          <Pole label="2d Naruszone zabezpieczenia (plomby)" wymagane info="Zamknięcia urzędowe — plomby, pieczęcie, stemple">
            <select value={naruszonePlomby} onChange={e => setNaruszonePlomby(e.target.value)} className={inputCls}>
              <option value="0">0 — Nie stwierdzono naruszenia</option>
              <option value="1">1 — Tak, stwierdzono naruszenie</option>
            </select>
          </Pole>
          <Pole label="2b Informacje dodatkowe" info="Max 350 zn.">
            <input value={infoPrzybycie} onChange={e => setInfoPrzybycie(e.target.value)} maxLength={350} className={inputCls} />
          </Pole>
        </div>
      </Sekcja>

      <Sekcja nr="3" tytul="Podmiot odbierający (3a-3h)" kolor="purple">
        <TraderForm prefix="odb" label="" val={odbiorca} onChange={setOdbiorca} />
      </Sekcja>

      <Sekcja nr="4" tytul="Miejsce odbioru (4a-4h) — jeśli różne od podmiotu odbierającego" kolor="purple">
        <div className="flex items-center gap-2 mb-3">
          <input type="checkbox" id="showMDD817" checked={showMiejsce} onChange={e => setShowMiejsce(e.target.checked)} />
          <label htmlFor="showMDD817" className="text-sm text-gray-600 cursor-pointer">Miejsce odbioru jest inne niż podmiot odbierający</label>
        </div>
        {showMiejsce && <TraderForm prefix="mo" label="" val={miejsceOdbioru} onChange={setMiejsceOdbioru} />}
      </Sekcja>

      <Sekcja nr="5" tytul="Miejsce dostawy — urząd skarbowy (5a)" kolor="purple">
        <Pole label="5a Nr referencyjny urzędu" wymagane info="np. PL402000">
          <input value={urzad} onChange={e => setUrzad(e.target.value)} maxLength={8} className={inputCls} style={{ maxWidth: 200 }} />
        </Pole>
      </Sekcja>

      <Akcje typ="DD817"
        onPodglad={() => { const x = generuj(); setXmlPodglad(x); setShowXML(true) }}
        onPobierz={() => { const x = generuj(); pobierzXML(x, `DD817_${arc || 'draft'}.xml`); setSukces('Plik pobrany!'); setTimeout(() => setSukces(''), 2000) }}
        onKopiuj={() => kopiujXML(generuj())}
      />
    </div>
  )
}

// ============================================================
// ===== DD818 — Raport odbioru =====
// ============================================================
function FormDD818({ daneFirmy, nextMsgId, addHistoria, pobierzXML, kopiujXML, setXmlPodglad, setShowXML, setSukces, nsVersion = '2025/03' }: any) {
  const ns = buildNs(nsVersion)
  const [jezyk, setJezyk] = useState('pl')
  const [arc, setArc] = useState('')
  const [seqNr, setSeqNr] = useState('1')
  const [odbiorca, setOdbiorca] = useState(emptyTrader('2'))
  const [showMiejsce, setShowMiejsce] = useState(false)
  const [miejsceOdbioru, setMiejsceOdbioru] = useState(emptyTrader('2'))
  const [urzad, setUrzad] = useState('')
  const [dataOdbioru, setDataOdbioru] = useState(new Date().toISOString().split('T')[0])
  const [wynikOdbioru, setWynikOdbioru] = useState('1')
  const [dodInfo, setDodInfo] = useState('')
  // Sekcja 6 — wyroby (gdy wynik != 1)
  const [bodyRef, setBodyRef] = useState('1')
  const [ubytekNadwyzka, setUbytekNadwyzka] = useState('S')
  const [iloscUbytku, setIloscUbytku] = useState('')
  const [iloscNieprzyjeta, setIloscNieprzyjeta] = useState('')
  // Sekcja 6.1 — rodzaj zastrzeżeń
  const [rodzajZastrzezenKod, setRodzajZastrzezenKod] = useState('')
  const [zastrzezeniaInfo, setZastrzezeniaInfo] = useState('')
  // Sekcja 7 — zabezpieczenie
  const [showGwar, setShowGwar] = useState(false)
  const [gwarGRN, setGwarGRN] = useState('')
  const [gwarKod, setGwarKod] = useState('')
  const [gwarTIN, setGwarTIN] = useState('')
  // Sekcja 8 — przeznaczenie do zwolnienia
  const [showExemption, setShowExemption] = useState(false)
  const [exemptionKod, setExemptionKod] = useState('')
  const [exemptionOpis, setExemptionOpis] = useState('')

  const needsBody = !['1', '21'].includes(wynikOdbioru)

  function generuj(): string {
    const { date, time } = now()
    const msgId = nextMsgId()
    const lang = jezyk || 'pl'

    const tb818 = (pfx: string, tag: string, t: any) => {
      const dtt = t.id_typ === 'personal' ? '8' : t.id_typ === 'excise' ? '3' : (t.typ || '3')
      const idX = t.id_typ === 'excise'
        ? `<ddTypes:ExciseNumber>${esc(t.id)}</ddTypes:ExciseNumber>`
        : t.id_typ === 'tax'
        ? `<ddTypes:TaxNumber>${esc(t.id)}</ddTypes:TaxNumber>`
        : `<ddTypes:PersonalId>${esc(t.id)}</ddTypes:PersonalId>`
      return `          <${pfx}:${tag} language="${lang}" deliveryTraderType="${dtt}">
            <ddTypes:Traderid>${idX}</ddTypes:Traderid>
            <ddTypes:TraderName>${esc(t.nazwa)}</ddTypes:TraderName>
            <ddTypes:StreetName>${esc(t.ulica)}</ddTypes:StreetName>
            ${t.nr_domu ? `<ddTypes:StreetNumber>${esc(t.nr_domu)}</ddTypes:StreetNumber>` : ''}
            <ddTypes:Postcode>${esc(t.kod)}</ddTypes:Postcode>
            <ddTypes:City>${esc(t.miasto)}</ddTypes:City>
          </${pfx}:${tag}>`
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ddEnv:TraderToEDD xmlns:dd818="${ns.DD818}" xmlns:ddTypes="${ns.TYPES}" xmlns:ddHeaderType="${ns.HEADER}" xmlns:ddEnv="${ns.ENV}">
  <ddEnv:Message>
    <dd818:DD818>
      <dd818:Header>
        <ddHeaderType:MessageSender>${esc(daneFirmy.nr_akcyzowy)}</ddHeaderType:MessageSender>
        <ddHeaderType:MessageRecipient>NDEA.PL</ddHeaderType:MessageRecipient>
        <ddHeaderType:DateOfPreparation>${date}</ddHeaderType:DateOfPreparation>
        <ddHeaderType:TimeOfPreparation>${time}</ddHeaderType:TimeOfPreparation>
        <ddHeaderType:MessageIdentifier>${esc(msgId)}</ddHeaderType:MessageIdentifier>
      </dd818:Header>
      <dd818:Body>
        <dd818:AcceptedOrRejectedReportOfReceipt>
          <dd818:DocumentReference>
            <ddTypes:DeliveryDocumentAdministrativeReferenceCode>${esc(arc)}</ddTypes:DeliveryDocumentAdministrativeReferenceCode>
            <ddTypes:SequenceNumber>${seqNr}</ddTypes:SequenceNumber>
          </dd818:DocumentReference>
          <dd818:ReportOfReceipt>
            <dd818:DateOfArrivalOfExciseProducts>${dataOdbioru}</dd818:DateOfArrivalOfExciseProducts>
            <dd818:GlobalConclusionOfReceipt>${wynikOdbioru}</dd818:GlobalConclusionOfReceipt>
            ${dodInfo ? `<dd818:ComplementaryInformation language="${lang}">${esc(dodInfo)}</dd818:ComplementaryInformation>` : ''}
          </dd818:ReportOfReceipt>
${tb818('dd818', 'ConsigneeTrader', odbiorca)}
${showMiejsce ? tb818('dd818', 'DeliveryPlaceTrader', miejsceOdbioru) : ''}
          <dd818:DestinationOffice>
            <ddTypes:ReferenceNumber>${esc(urzad)}</ddTypes:ReferenceNumber>
          </dd818:DestinationOffice>
          ${showGwar ? `<dd818:StorageGuarantee>
            <dd818:GuaranteeReferenceNumber>${esc(gwarGRN)}</dd818:GuaranteeReferenceNumber>
            <dd818:GuaranteeReferenceNumberAccessCode>${esc(gwarKod)}</dd818:GuaranteeReferenceNumberAccessCode>
            <dd818:GuarantorTIN>PL${(gwarTIN||FIRMA.nip).toUpperCase().replace(/^PL/,'')}</dd818:GuarantorTIN>
          </dd818:StorageGuarantee>` : ''}
          ${needsBody ? `<dd818:BodyReportOfReceipt>
            <dd818:BodyRecordUniqueReference>${esc(bodyRef)}</dd818:BodyRecordUniqueReference>
            <dd818:IndicatorOfShortageOrExcess>${ubytekNadwyzka}</dd818:IndicatorOfShortageOrExcess>
            ${iloscUbytku ? `<dd818:ObservedShortageOrExcess>${iloscUbytku}</dd818:ObservedShortageOrExcess>` : ''}
            ${iloscNieprzyjeta ? `<dd818:RefusedQuantity>${iloscNieprzyjeta}</dd818:RefusedQuantity>` : ''}
          </dd818:BodyReportOfReceipt>` : ''}
          ${showExemption ? `<dd818:BodyExciseExemptionInfo>
            <dd818:BodyRecordUniqueReference>1</dd818:BodyRecordUniqueReference>
            <ddTypes:ProductPurpose>${esc(exemptionKod)}</ddTypes:ProductPurpose>
            ${exemptionOpis ? `<ddTypes:ComplementaryInformation language="${lang}">${esc(exemptionOpis)}</ddTypes:ComplementaryInformation>` : ''}
          </dd818:BodyExciseExemptionInfo>` : ''}
        </dd818:AcceptedOrRejectedReportOfReceipt>
      </dd818:Body>
    </dd818:DD818>
  </ddEnv:Message>
</ddEnv:TraderToEDD>`
    addHistoria({ typ: 'DD818', msgId, arc, data: new Date().toISOString(), xml })
    return xml
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <span className="bg-green-100 text-green-800 text-sm font-bold px-3 py-1 rounded-lg">DD818</span>
        <div>
          <p className="text-sm font-medium text-gray-900">Raport odbioru</p>
          <p className="text-xs text-gray-500">Data przybycia = data rozładunku · Warunek zakończenia przemieszczenia</p>
        </div>
      </div>



      <Sekcja nr="1" tytul="Dokument e-DD" kolor="green">
        <div className="grid grid-cols-2 gap-3">
          <Pole label="1a Nr ARC" wymagane>
            <input value={arc} onChange={e => setArc(e.target.value.toUpperCase())} maxLength={21} className={inputCls + ' font-mono'} />
          </Pole>
          <Pole label="1b Nr porządkowy" wymagane>
            <input type="number" value={seqNr} onChange={e => setSeqNr(e.target.value)} min="1" className={inputCls} />
          </Pole>
        </div>
      </Sekcja>

      <Sekcja nr="2" tytul="Podmiot odbierający (2a-2h)" kolor="green">
        <TraderForm prefix="odb" label="" val={odbiorca} onChange={setOdbiorca} />
      </Sekcja>

      <Sekcja nr="3" tytul="Miejsce odbioru — jeśli różne od sekcji 2" kolor="green">
        <div className="flex items-center gap-2 mb-3">
          <input type="checkbox" id="showMDD818" checked={showMiejsce} onChange={e => setShowMiejsce(e.target.checked)} />
          <label htmlFor="showMDD818" className="text-sm text-gray-600 cursor-pointer">Adres miejsca odbioru różni się od podmiotu odbierającego</label>
        </div>
        {showMiejsce && <TraderForm prefix="mo" label="" val={miejsceOdbioru} onChange={setMiejsceOdbioru} />}
      </Sekcja>

      <Sekcja nr="4" tytul="Urząd właściwy w miejscu odbioru (4a)" kolor="green">
        <Pole label="4a Nr ref. urzędu" wymagane info="np. PL143844">
          <input value={urzad} onChange={e => setUrzad(e.target.value)} maxLength={8} className={inputCls} style={{ maxWidth: 200 }} />
        </Pole>
      </Sekcja>

      <Sekcja nr="5" tytul="Raport odbioru — wyniki (5a-5c)" kolor="green">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Pole label="5a Data przybycia wyrobów (rozładunku)" wymagane>
            <input type="date" value={dataOdbioru} onChange={e => setDataOdbioru(e.target.value)} className={inputCls} />
          </Pole>
          <Pole label="5b Ogólne wyniki odbioru" wymagane>
            <select value={wynikOdbioru} onChange={e => setWynikOdbioru(e.target.value)} className={inputCls}>
              {WYNIKI_ODBIORU.map(w => <option key={w.v} value={w.v}>{w.l}</option>)}
            </select>
          </Pole>
          <Pole label="5c Informacje dodatkowe" info="Max 350 zn.">
            <input value={dodInfo} onChange={e => setDodInfo(e.target.value)} maxLength={350} className={inputCls} />
          </Pole>
        </div>
      </Sekcja>

      {needsBody && (
        <Sekcja nr="6" tytul="Raport odbioru — wyroby (wymagane gdy wynik ≠ odbiór bez zastrzeżeń)" kolor="green">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Pole label="6a Nr id pozycji towarowej" wymagane>
              <input value={bodyRef} onChange={e => setBodyRef(e.target.value)} maxLength={3} className={inputCls} />
            </Pole>
            <Pole label="6b Niedobór (S) / Nadwyżka (E)" wymagane>
              <select value={ubytekNadwyzka} onChange={e => setUbytekNadwyzka(e.target.value)} className={inputCls}>
                <option value="S">S — Niedobór (shortage)</option>
                <option value="E">E — Nadwyżka (excess)</option>
              </select>
            </Pole>
            <Pole label="6c Stwierdzony niedobór/nadwyżka" info="W jednostkach miary wyrobu">
              <input type="number" value={iloscUbytku} onChange={e => setIloscUbytku(e.target.value)} min="0" className={inputCls} />
            </Pole>
            <Pole label="6e Ilość nieprzyjęta" info="Dla odmowy częściowej">
              <input type="number" value={iloscNieprzyjeta} onChange={e => setIloscNieprzyjeta(e.target.value)} min="0" className={inputCls} />
            </Pole>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Pole label="6.1a Rodzaj zastrzeżeń (kod)">
              <input value={rodzajZastrzezenKod} onChange={e => setRodzajZastrzezenKod(e.target.value)} maxLength={2} className={inputCls} />
            </Pole>
            <Pole label="6.1b Informacje dodatkowe o zastrzeżeniach">
              <input value={zastrzezeniaInfo} onChange={e => setZastrzezeniaInfo(e.target.value)} maxLength={350} className={inputCls} />
            </Pole>
          </div>
        </Sekcja>
      )}

      <Sekcja nr="7" tytul="Zabezpieczenie na magazynowanie — opcjonalne (GRN)" kolor="gray">
        <div className="flex items-center gap-2 mb-3">
          <input type="checkbox" checked={showGwar} onChange={e => setShowGwar(e.target.checked)} id="showGDD818" />
          <label htmlFor="showGDD818" className="text-sm text-gray-600 cursor-pointer">Wypełnij jeśli wyrób objęty zabezpieczeniem generalnym</label>
        </div>
        {showGwar && (
          <div className="grid grid-cols-3 gap-3">
            <Pole label="7a Nr GRN (17 zn.)" wymagane>
              <input value={gwarGRN} onChange={e => setGwarGRN(e.target.value)} maxLength={17} className={inputCls} />
            </Pole>
            <Pole label="7b Kod dostępu (4 cyfry)" wymagane>
              <input value={gwarKod} onChange={e => setGwarKod(e.target.value)} maxLength={4} className={inputCls} />
            </Pole>
            <Pole label="7c TIN wysyłającego (tylko cyfry NIP, bez PL)" wymagane>
              <input value={gwarTIN} onChange={e => setGwarTIN(e.target.value)} maxLength={14} placeholder="PL0000000000" className={inputCls} />
            </Pole>
          </div>
        )}
      </Sekcja>

      <Sekcja nr="8" tytul="Przeznaczenie uprawniające do zwolnienia — obowiązkowe dla wyrobów zwolnionych" kolor="gray">
        <div className="flex items-center gap-2 mb-3">
          <input type="checkbox" checked={showExemption} onChange={e => setShowExemption(e.target.checked)} id="showExDD818" />
          <label htmlFor="showExDD818" className="text-sm text-gray-600 cursor-pointer">Wyrób jest zwolniony ze względu na przeznaczenie</label>
        </div>
        {showExemption && (
          <div className="grid grid-cols-2 gap-3">
            <Pole label="8d Przeznaczenie wyrobu (kod)" wymagane>
              <input value={exemptionKod} onChange={e => setExemptionKod(e.target.value)} className={inputCls} />
            </Pole>
            <Pole label="8e Opis przeznaczenia">
              <input value={exemptionOpis} onChange={e => setExemptionOpis(e.target.value)} maxLength={350} className={inputCls} />
            </Pole>
          </div>
        )}
      </Sekcja>

      <Akcje typ="DD818"
        onPodglad={() => { const x = generuj(); setXmlPodglad(x); setShowXML(true) }}
        onPobierz={() => { const x = generuj(); pobierzXML(x, `DD818_${arc || 'draft'}.xml`); setSukces('Plik pobrany!'); setTimeout(() => setSukces(''), 2000) }}
        onKopiuj={() => kopiujXML(generuj())}
      />
    </div>
  )
}

// ============================================================
// ===== DD818B — Raport odbioru B (zbiorczy) dla LPG =====
// ============================================================
function FormDD818B({ daneFirmy, nextMsgId, addHistoria, pobierzXML, kopiujXML, setXmlPodglad, setShowXML, setSukces, historia = [], nsVersion = '2025/03' }: any) {
  const ns = buildNs(nsVersion)
  const [jezyk, setJezyk] = useState('pl')
  const [arc, setArc] = useState('')
  const [seqNr, setSeqNr] = useState('1')
  const [showZaciagnij815, setShowZaciagnij815] = useState(false)

  // Zaciągnij dane z DD815B z historii
  function zaciagnijZ815(h: any) {
    if (h.lrn) setArc('') // ARC jest inne niż LRN — zostawiamy puste do wpisania
    if (h.odbiorcy) setOdbiorcy(h.odbiorcy.map((o: any) => ({
      odbiorca: { ...o.odbiorca },
      miejsceOdbioru: { ...(o.miejsceOdbioru || o.odbiorca) },
      showMiejsce: o.showMiejsce || false,
      urzad: o.urzad || '',
      ilosc: o.ilosc || '',
      dataOdbioru: new Date().toISOString().split('T')[0],
      showExemption: true,
      exemptionKod: '56',
      exemptionOpis: 'Cele opałowe',
    })))
    if (h.kodCN) setKodCN(h.kodCN)
    if (h.exciseCode) setExciseCode(h.exciseCode)
    setShowZaciagnij815(false)
    setSukces(`Zaciągnięto ${h.odbiorcy?.length || 0} odbiorców z DD815B (LRN: ${h.lrn || '?'}) — uzupełnij nr ARC!`)
    setTimeout(() => setSukces(''), 5000)
  }

  // Kod wyrobu (sekcja 3)
  const [kodCN, setKodCN] = useState('27111900')
  const [exciseCode, setExciseCode] = useState('E500')
  // Odbiorcy (sekcja 2 — wielokrotna)
  const [odbiorcy, setOdbiorcy] = useState([{
    odbiorca: emptyTrader('2'), miejsceOdbioru: emptyTrader('2'), urzad: '',
    ilosc: '', dataOdbioru: new Date().toISOString().split('T')[0],
    showMiejsce: false, showGwar: false, gwarGRN: '', gwarKod: '', gwarTIN: '',
    showExemption: false, exemptionKod: '', exemptionOpis: '',
  }])
  // Sekcja 4 — odbiór przez wysyłającego (opcjonalny)
  const [showKonsignor, setShowKonsignor] = useState(false)
  const [konsignorIlosc, setKonsignorIlosc] = useState('')
  const [konsignorData, setKonsignorData] = useState(new Date().toISOString().split('T')[0])

  function generuj(): string {
    const { date, time } = now()
    const msgId = nextMsgId()
    const lang = jezyk || 'pl'

    const tT = (tag: string, t: any) => {
      const dtt = t.id_typ === 'personal' ? '8' : t.id_typ === 'excise' ? '3' : (t.typ || '3')
      const idX = t.id_typ === 'excise'
        ? `<ddTypes:ExciseNumber>${esc(t.id)}</ddTypes:ExciseNumber>`
        : t.id_typ === 'tax'
        ? `<ddTypes:TaxNumber>${esc(t.id)}</ddTypes:TaxNumber>`
        : `<ddTypes:PersonalId>${esc(t.id)}</ddTypes:PersonalId>`
      return `            <ddTypes:${tag} language="${lang}" deliveryTraderType="${dtt}">
              <ddTypes:Traderid>${idX}</ddTypes:Traderid>
              <ddTypes:TraderName>${esc(t.nazwa)}</ddTypes:TraderName>
              <ddTypes:StreetName>${esc(t.ulica)}</ddTypes:StreetName>
              ${t.nr_domu ? `<ddTypes:StreetNumber>${esc(t.nr_domu)}</ddTypes:StreetNumber>` : ''}
              <ddTypes:Postcode>${esc(t.kod)}</ddTypes:Postcode>
              <ddTypes:City>${esc(t.miasto)}</ddTypes:City>
            </ddTypes:${tag}>`
    }

    const consignees = odbiorcy.map((o: any) => `          <dd818b:ConsigneeTraders ReceivedQuantity="${o.ilosc}" DateOfArrivalOfExciseProducts="${o.dataOdbioru}">
${tT('ConsigneeTrader', o.odbiorca)}
${o.showMiejsce && o.miejsceOdbioru?.id ? tT('DeliveryPlaceTrader', o.miejsceOdbioru) : tT('DeliveryPlaceTrader', o.odbiorca)}
            <ddTypes:DeliveryPlaceCustomsOffice>
              <ddTypes:ReferenceNumber>${esc(o.urzad)}</ddTypes:ReferenceNumber>
            </ddTypes:DeliveryPlaceCustomsOffice>
            ${o.showExemption ? `<ddTypes:ExciseExemption>
              <ddTypes:ProductPurpose>${esc(o.exemptionKod)}</ddTypes:ProductPurpose>
              <ddTypes:ComplementaryInformation language="${lang}">${esc(o.exemptionOpis || 'Cele opałowe')}</ddTypes:ComplementaryInformation>
            </ddTypes:ExciseExemption>` : ''}
          </dd818b:ConsigneeTraders>`).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ddEnv:TraderToEDD xmlns:dd818b="${ns.DD818B}" xmlns:ddTypes="${ns.TYPES}" xmlns:ddHeaderType="${ns.HEADER}" xmlns:ddEnv="${ns.ENV}">
  <ddEnv:Message>
    <dd818b:DD818B>
      <dd818b:Header>
        <ddHeaderType:MessageSender>${esc(daneFirmy.nr_akcyzowy)}</ddHeaderType:MessageSender>
        <ddHeaderType:MessageRecipient>NDEA.PL</ddHeaderType:MessageRecipient>
        <ddHeaderType:DateOfPreparation>${date}</ddHeaderType:DateOfPreparation>
        <ddHeaderType:TimeOfPreparation>${time}</ddHeaderType:TimeOfPreparation>
        <ddHeaderType:MessageIdentifier>${esc(msgId)}</ddHeaderType:MessageIdentifier>
      </dd818b:Header>
      <dd818b:Body>
        <dd818b:AcceptedOrRejectedReportOfReceipt>
          <dd818b:DocumentReference>
            <ddTypes:DeliveryDocumentAdministrativeReferenceCode>${esc(arc)}</ddTypes:DeliveryDocumentAdministrativeReferenceCode>
            <ddTypes:SequenceNumber>${seqNr}</ddTypes:SequenceNumber>
          </dd818b:DocumentReference>
${consignees}
          <dd818b:BodyEDDInfo>
            <dd818b:ExciseProductCode>${esc(exciseCode)}</dd818b:ExciseProductCode>
            <dd818b:CnCode>${esc(kodCN)}</dd818b:CnCode>
          </dd818b:BodyEDDInfo>
        </dd818b:AcceptedOrRejectedReportOfReceipt>
      </dd818b:Body>
    </dd818b:DD818B>
  </ddEnv:Message>
</ddEnv:TraderToEDD>`
    addHistoria({ typ: 'DD818B', msgId, arc, data: new Date().toISOString(), xml })
    return xml
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <span className="bg-green-100 text-green-800 text-sm font-bold px-3 py-1 rounded-lg">DD818B</span>
        <div>
          <p className="text-sm font-medium text-gray-900">Raport odbioru B — zbiorczy (dla LPG)</p>
          <p className="text-xs text-gray-500">Każdy odbiorca zgłasza faktycznie odebraną ilość · Sekcja 2 wielokrotna</p>
        </div>
      </div>

      {/* Zaciągnij z DD815B */}
      <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-medium text-emerald-800">📥 Zaciągnij odbiorców z DD815B</p>
            <p className="text-xs text-emerald-600 mt-0.5">Automatycznie wypełni listę odbiorców na podstawie wcześniej wystawionego DD815B</p>
          </div>
          <button type="button" onClick={() => setShowZaciagnij815(v => !v)}
            className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1.5">
            {showZaciagnij815 ? '▲ Zwiń' : '📋 Wybierz DD815B'}
          </button>
        </div>
        {showZaciagnij815 && (
          <div className="mt-3 space-y-2">
            {historia.filter((h: any) => h.typ === 'DD815B' && h.odbiorcy?.length > 0).length === 0 ? (
              <p className="text-xs text-emerald-600">Brak DD815B w historii — najpierw wygeneruj dokument DD815B.</p>
            ) : historia.filter((h: any) => h.typ === 'DD815B' && h.odbiorcy?.length > 0).map((h: any) => (
              <div key={h.id} className="flex items-center justify-between bg-white border border-emerald-200 rounded-lg p-2.5">
                <div>
                  <p className="text-xs font-medium text-gray-900">LRN: <span className="font-mono">{h.lrn || '—'}</span></p>
                  <p className="text-xs text-gray-500">{h.odbiorcy?.length} odbiorców · {new Date(h.data).toLocaleString('pl-PL')}</p>
                  {h.kodCN && <p className="text-xs text-gray-400">CN: {h.kodCN} / {h.exciseCode}</p>}
                </div>
                <button type="button" onClick={() => zaciagnijZ815(h)}
                  className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  Zaciągnij
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sekcja nr="1" tytul="Dokument e-DD" kolor="green">
        <div className="grid grid-cols-2 gap-3">
          <Pole label="1a Nr ARC" wymagane>
            <input value={arc} onChange={e => setArc(e.target.value.toUpperCase())} maxLength={21} className={inputCls + ' font-mono'} />
          </Pole>
          <Pole label="1b Nr porządkowy" wymagane>
            <input type="number" value={seqNr} onChange={e => setSeqNr(e.target.value)} min="1" className={inputCls} />
          </Pole>
        </div>
      </Sekcja>

      <Sekcja nr="2" tytul="Podmioty odbierające (sekcja 2 — wielokrotna)" kolor="green">
        {odbiorcy.map((o, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-600">Odbiorca {i + 1}</span>
              {odbiorcy.length > 1 && <button onClick={() => setOdbiorcy(p => p.filter((_, j) => j !== i))} className="text-xs text-red-500">Usuń</button>}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Pole label="2.4a Odebrana ilość" wymagane>
                <input type="number" value={o.ilosc} onChange={e => setOdbiorcy(p => p.map((x, j) => j === i ? { ...x, ilosc: e.target.value } : x))} min="0" className={inputCls} />
              </Pole>
              <Pole label="2.4c Data przybycia wyrobów" wymagane>
                <input type="date" value={o.dataOdbioru} onChange={e => setOdbiorcy(p => p.map((x, j) => j === i ? { ...x, dataOdbioru: e.target.value } : x))} className={inputCls} />
              </Pole>
            </div>
            <p className="text-xs font-medium text-gray-500 mb-2">2.1 Podmiot odbierający</p>
            <TraderForm prefix={`o${i}`} label="" val={o.odbiorca}
              onChange={v => setOdbiorcy(p => p.map((x, j) => j === i ? { ...x, odbiorca: v } : x))} />
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" checked={o.showMiejsce}
                  onChange={e => setOdbiorcy(p => p.map((x, j) => j === i ? { ...x, showMiejsce: e.target.checked } : x))} />
                <span className="text-xs text-gray-500">2.2 Miejsce odbioru różne</span>
              </div>
              {o.showMiejsce && <TraderForm prefix={`mo${i}`} label="" val={o.miejsceOdbioru}
                onChange={v => setOdbiorcy(p => p.map((x, j) => j === i ? { ...x, miejsceOdbioru: v } : x))} />}
            </div>
            <div className="mt-2">
              <Pole label="2.3a Urząd odbioru" wymagane info="np. PL402000">
                <input value={o.urzad} onChange={e => setOdbiorcy(p => p.map((x, j) => j === i ? { ...x, urzad: e.target.value } : x))}
                  maxLength={8} className={inputCls} style={{ maxWidth: 180 }} />
              </Pole>
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" checked={o.showExemption}
                  onChange={e => setOdbiorcy(p => p.map((x, j) => j === i ? { ...x, showExemption: e.target.checked } : x))} />
                <span className="text-xs text-gray-500">2.5 Przeznaczenie uprawniające do zwolnienia</span>
              </div>
              {o.showExemption && (
                <div className="grid grid-cols-2 gap-3 ml-4">
                  <Pole label="2.5a Przeznaczenie (kod)" wymagane>
                    <input value={o.exemptionKod} onChange={e => setOdbiorcy(p => p.map((x, j) => j === i ? { ...x, exemptionKod: e.target.value } : x))} className={inputCls} />
                  </Pole>
                  <Pole label="2.5b Opis przeznaczenia">
                    <input value={o.exemptionOpis} onChange={e => setOdbiorcy(p => p.map((x, j) => j === i ? { ...x, exemptionOpis: e.target.value } : x))} maxLength={350} className={inputCls} />
                  </Pole>
                </div>
              )}
            </div>
          </div>
        ))}
        <button onClick={() => setOdbiorcy(p => [...p, {
          odbiorca: emptyTrader('2'), miejsceOdbioru: emptyTrader('2'), urzad: '',
          ilosc: '', dataOdbioru: new Date().toISOString().split('T')[0],
          showMiejsce: false, showGwar: false, gwarGRN: '', gwarKod: '', gwarTIN: '',
          showExemption: false, exemptionKod: '', exemptionOpis: '',
        }])}
          className="text-xs border border-dashed border-gray-300 rounded-lg px-4 py-2 text-gray-500 hover:border-gray-400 w-full">
          + Dodaj kolejnego odbiorcę
        </button>
      </Sekcja>

      <Sekcja nr="3" tytul="Informacje o wyrobach (3a-3b)" kolor="green">
        <div className="grid grid-cols-2 gap-3">
          <Pole label="3a Kod wyrobu akcyzowego" wymagane>
            <select value={kodCN} onChange={e => {
              const k = KODY_CN.find(x => x.v === e.target.value)
              setKodCN(e.target.value)
              if (k) setExciseCode(k.e)
            }} className={inputCls}>
              {KODY_CN.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </Pole>
          <Pole label="Kod wyrobu (ExciseProductCode, 4 zn.)" wymagane>
            <input value={exciseCode} onChange={e => setExciseCode(e.target.value)} maxLength={4} className={inputCls} />
          </Pole>
        </div>
      </Sekcja>

      <Sekcja nr="4" tytul="Odbiór przez wysyłającego — sekcja 4 (opcjonalne)" kolor="gray">
        <div className="flex items-center gap-2 mb-3">
          <input type="checkbox" checked={showKonsignor} onChange={e => setShowKonsignor(e.target.checked)} id="showKons" />
          <label htmlFor="showKons" className="text-sm text-gray-600 cursor-pointer">Część wyrobów odbierana przez podmiot wysyłający</label>
        </div>
        {showKonsignor && (
          <div className="grid grid-cols-2 gap-3 ml-4">
            <Pole label="4a Odebrana ilość" wymagane>
              <input type="number" value={konsignorIlosc} onChange={e => setKonsignorIlosc(e.target.value)} min="0" className={inputCls} />
            </Pole>
            <Pole label="4b Data przybycia" wymagane>
              <input type="date" value={konsignorData} onChange={e => setKonsignorData(e.target.value)} className={inputCls} />
            </Pole>
          </div>
        )}
      </Sekcja>

      <Akcje typ="DD818B"
        onPodglad={() => { const x = generuj(); setXmlPodglad(x); setShowXML(true) }}
        onPobierz={() => { const x = generuj(); pobierzXML(x, `DD818B_${arc || 'draft'}.xml`); setSukces('Plik pobrany!'); setTimeout(() => setSukces(''), 2000) }}
        onKopiuj={() => kopiujXML(generuj())}
      />
    </div>
  )
}