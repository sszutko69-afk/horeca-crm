'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

// ================================================================
// STAŁE
// ================================================================
const MIESIACE = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']

const SWIETA = new Set([
  '2024-01-01','2024-01-06','2024-03-31','2024-04-01','2024-05-01','2024-05-03',
  '2024-05-19','2024-05-30','2024-08-15','2024-11-01','2024-11-11','2024-12-25','2024-12-26',
  '2025-01-01','2025-01-06','2025-04-20','2025-04-21','2025-05-01','2025-05-03',
  '2025-06-08','2025-06-19','2025-08-15','2025-11-01','2025-11-11','2025-12-25','2025-12-26',
  '2026-01-01','2026-01-06','2026-04-05','2026-04-06','2026-05-01','2026-05-03',
  '2026-05-24','2026-06-04','2026-08-15','2026-11-01','2026-11-11','2026-12-25','2026-12-26',
  '2027-01-01','2027-01-06','2027-03-28','2027-03-29','2027-05-01','2027-05-03',
  '2027-05-16','2027-05-27','2027-08-15','2027-11-01','2027-11-11','2027-12-25','2027-12-26',
])

// Domyślne stawki — używane tylko jeśli baza nie zwróci danych
const DEFAULTS: Record<string, number> = {
  zus_em_prac: 9.76, zus_rent_prac: 1.50, zus_choro_prac: 2.45, zus_zdrowotna: 9.00,
  zus_em_pracodawca: 9.76, zus_rent_pracodawca: 6.50, zus_wypadkowa: 1.67, fp: 2.45, fgssp: 0.10,
  pit_prog1: 12.00, pit_prog2: 32.00, pit_prog1_limit: 120000, pit_kwota_wolna: 30000, kup: 250,
  l4_procent: 80, min_wynagrodzenie: 4666,
}

const KATEGORIE_STAWEK = [
  {
    id: 'ZUS pracownik', label: 'ZUS Pracownik',
    pola: [
      { id: 'zus_em_prac',   label: 'Emerytalne [%]'  },
      { id: 'zus_rent_prac', label: 'Rentowe [%]'     },
      { id: 'zus_choro_prac',label: 'Chorobowe [%]'   },
      { id: 'zus_zdrowotna', label: 'Zdrowotna [%]'   },
    ],
  },
  {
    id: 'ZUS pracodawca', label: 'ZUS Pracodawca',
    pola: [
      { id: 'zus_em_pracodawca',   label: 'Emerytalne [%]'   },
      { id: 'zus_rent_pracodawca', label: 'Rentowe [%]'      },
      { id: 'zus_wypadkowa',       label: 'Wypadkowe [%]'    },
      { id: 'fp',                  label: 'Fundusz Pracy [%]' },
      { id: 'fgssp',               label: 'FGŚP [%]'         },
    ],
  },
  {
    id: 'PIT', label: 'Podatek PIT',
    pola: [
      { id: 'pit_prog1',        label: 'I próg [%]'           },
      { id: 'pit_prog2',        label: 'II próg [%]'          },
      { id: 'pit_prog1_limit',  label: 'Limit I progu [zł/rok]'},
      { id: 'pit_kwota_wolna',  label: 'Kwota wolna [zł/rok]' },
      { id: 'kup',              label: 'KUP [zł/mies]'        },
    ],
  },
  {
    id: 'Inne', label: 'Inne',
    pola: [
      { id: 'l4_procent',        label: 'L4 – % podstawy'          },
      { id: 'min_wynagrodzenie', label: 'Min. wynagrodzenie [zł]'  },
    ],
  },
]

// ================================================================
// TYPY
// ================================================================
type Pracownik = {
  id: string; imie: string; nazwisko: string; stanowisko: string
  rodzaj_umowy: string | null; wynagrodzenie_brutto: number | null
  stawka_godzinowa: number | null; wymiar_etatu: number | null; aktywny: boolean
}

function wymiarLabel(v: number | null | undefined): string {
  const w = v ?? 1
  if (w >= 1)                     return 'pełny etat'
  if (Math.abs(w - 0.75) < 0.02) return '3/4 etatu'
  if (Math.abs(w - 0.5)  < 0.02) return '1/2 etatu'
  if (Math.abs(w - 1/3)  < 0.02) return '1/3 etatu'
  if (Math.abs(w - 0.25) < 0.02) return '1/4 etatu'
  return `${(w * 100).toFixed(0)}% etatu`
}
type CzasWpis = {
  pracownik_id: string; data: string; rodzaj: string
  godziny: number; delegacja: boolean; delegacja_stawka: number | null
}
type Stawki = Record<string, number>
type Nalic = {
  pid: string
  godz_praca: number; godz_ng: number; godz_l4: number; godz_urlop: number
  godz_nieob: number; godz_szkol: number; godz_deleg: number; deleg_kwota: number
  premia: number; potracenia: number
  wynagrodzenie_podst: number
  brutto: number
  zus_em_prac: number; zus_rent_prac: number; zus_choro_prac: number
  zus_prac_total: number
  podstawa_zdrowotna: number; zus_zdrowotna: number
  podstawa_pit: number; podatek_brutto: number; ulga_pit: number; zaliczka_pit: number
  netto: number
  zus_em_pracodawca: number; zus_rent_pracodawca: number; zus_wypadkowa: number
  fp: number; fgssp: number; zus_pracodawca_total: number; koszt_pracodawcy: number
  status: 'projekt' | 'zatwierdzone' | 'wyplacone'
  notatki: string
}

const STATUS_BADGE: Record<string, string> = {
  projekt:      'bg-gray-100 text-gray-600',
  zatwierdzone: 'bg-blue-100 text-blue-700',
  wyplacone:    'bg-green-100 text-green-700',
}

// ================================================================
// HELPERS
// ================================================================
function r2(n: number) { return Math.round(n * 100) / 100 }
function fmt(n: number | null | undefined, dec = 2) {
  if (n == null) return '—'
  return n.toLocaleString('pl-PL', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtPct(n: number) { return n.toFixed(2).replace('.', ',') + '%' }

function roboczeDni(rok: number, miesiac: number): number {
  const dni = new Date(rok, miesiac, 0).getDate()
  let count = 0
  for (let d = 1; d <= dni; d++) {
    const dt  = new Date(rok, miesiac - 1, d)
    const iso = `${rok}-${String(miesiac).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    if (dt.getDay() !== 0 && dt.getDay() !== 6 && !SWIETA.has(iso)) count++
  }
  return count
}

// ================================================================
// KALKULATOR POLSKIEJ LISTY PŁAC (UoP, 2026)
// ================================================================
function calcNalic(
  p: Pracownik,
  wpisy: CzasWpis[],
  robDni: number,
  extra: { premia: number; potracenia: number; status: Nalic['status']; notatki: string },
  st: Stawki,
): Nalic {
  const pw = wpisy.filter(w => w.pracownik_id === p.id)
  const sumH = (rodzaj: string) =>
    pw.filter(w => w.rodzaj === rodzaj).reduce((a, w) => a + (+w.godziny || 0), 0)

  const godz_praca  = sumH('praca')
  const godz_ng     = sumH('nadgodziny')
  const godz_l4     = sumH('l4')
  const godz_urlop  = sumH('urlop')
  const godz_nieob  = sumH('nieobecnosc_inna')
  const godz_szkol  = sumH('szkolenie')
  const godz_deleg  = sumH('delegacja')

  // Delegacja: unikalne dni × stawka
  const delegDni   = new Set(pw.filter(w => w.delegacja).map(w => w.data)).size
  const delegStawka = pw.find(w => w.delegacja)?.delegacja_stawka ?? 45
  const deleg_kwota = r2(delegDni * delegStawka)

  // ── Wynagrodzenie podstawowe ───────────────────────────────
  // Norma godzin = dni robocze × 8h × wymiar etatu
  const wymiar   = Math.max(0.01, p.wymiar_etatu ?? 1)
  const normHours = robDni * 8 * wymiar

  let wynagrodzenie_podst = 0
  if (p.wynagrodzenie_brutto && robDni > 0) {
    // stawkaH jest dla wymiaru — dzielimy przez normę uwzględniającą wymiar
    const stawkaH  = p.wynagrodzenie_brutto / normHours
    const l4Rate   = (st.l4_procent ?? 80) / 100
    wynagrodzenie_podst = r2(
      (godz_praca + godz_urlop + godz_szkol + godz_deleg) * stawkaH +
       godz_l4  * stawkaH * l4Rate +
       godz_ng  * stawkaH * 1.5
    )
  } else if (p.stawka_godzinowa) {
    const s = p.stawka_godzinowa
    const l4Rate = (st.l4_procent ?? 80) / 100
    wynagrodzenie_podst = r2(
      godz_praca * s +
      godz_ng    * s * 1.5 +
      godz_l4    * s * l4Rate +
      godz_urlop * s +
      godz_szkol * s
    )
  }

  const brutto = Math.max(0, r2(wynagrodzenie_podst + extra.premia + deleg_kwota - extra.potracenia))

  // ── ZUS pracownika ─────────────────────────────────────────
  const zus_em_prac    = r2(brutto * (st.zus_em_prac    ?? 9.76) / 100)
  const zus_rent_prac  = r2(brutto * (st.zus_rent_prac  ?? 1.50) / 100)
  const zus_choro_prac = r2(brutto * (st.zus_choro_prac ?? 2.45) / 100)
  const zus_prac_total = r2(zus_em_prac + zus_rent_prac + zus_choro_prac)

  // ── Składka zdrowotna ──────────────────────────────────────
  const podstawa_zdrowotna = r2(brutto - zus_prac_total)
  const zus_zdrowotna      = r2(podstawa_zdrowotna * (st.zus_zdrowotna ?? 9.00) / 100)

  // ── PIT ───────────────────────────────────────────────────
  // Koszty UP
  const kup = st.kup ?? 250
  // Podstawa opodatkowania – zaokrąglona do pełnych złotych
  const podstawa_pit = Math.max(0, Math.round(brutto - zus_prac_total - kup))
  // Procent progu
  const progLimit   = st.pit_prog1_limit ?? 120000
  const pitProg1    = (st.pit_prog1 ?? 12) / 100
  const pitProg2    = (st.pit_prog2 ?? 32) / 100
  // Uproszczone: całość w I progu gdy nie przekracza limitu rocznego (kontrola roczna poza zakresem)
  const podatek_brutto = r2(podstawa_pit * pitProg1)
  // Kwota zmniejszająca podatek = kwota_wolna × pit_prog1 / 12
  const ulga_pit    = r2((st.pit_kwota_wolna ?? 30000) * pitProg1 / 12)
  const zaliczka_pit = Math.max(0, Math.round(podatek_brutto - ulga_pit))

  // ── Netto ─────────────────────────────────────────────────
  const netto = r2(brutto - zus_prac_total - zus_zdrowotna - zaliczka_pit)

  // ── ZUS pracodawcy ─────────────────────────────────────────
  const zus_em_pracodawca   = r2(brutto * (st.zus_em_pracodawca   ?? 9.76) / 100)
  const zus_rent_pracodawca = r2(brutto * (st.zus_rent_pracodawca ?? 6.50) / 100)
  const zus_wypadkowa_kwota = r2(brutto * (st.zus_wypadkowa       ?? 1.67) / 100)
  const fp_kwota            = r2(brutto * (st.fp    ?? 2.45) / 100)
  const fgssp_kwota         = r2(brutto * (st.fgssp ?? 0.10) / 100)
  const zus_pracodawca_total = r2(zus_em_pracodawca + zus_rent_pracodawca + zus_wypadkowa_kwota + fp_kwota + fgssp_kwota)
  const koszt_pracodawcy    = r2(brutto + zus_pracodawca_total)

  return {
    pid: p.id,
    godz_praca, godz_ng, godz_l4, godz_urlop, godz_nieob, godz_szkol, godz_deleg, deleg_kwota,
    premia: extra.premia, potracenia: extra.potracenia,
    wynagrodzenie_podst, brutto,
    zus_em_prac, zus_rent_prac, zus_choro_prac, zus_prac_total,
    podstawa_zdrowotna, zus_zdrowotna,
    podstawa_pit, podatek_brutto, ulga_pit, zaliczka_pit,
    netto,
    zus_em_pracodawca, zus_rent_pracodawca,
    zus_wypadkowa: zus_wypadkowa_kwota, fp: fp_kwota, fgssp: fgssp_kwota,
    zus_pracodawca_total, koszt_pracodawcy,
    status:  extra.status,
    notatki: extra.notatki,
  }
}

// ================================================================
// KOMPONENT GŁÓWNY
// ================================================================
export default function PlacePage() {
  const supabase = createClient()
  const now  = new Date()
  const [rok,  setRok]  = useState(now.getFullYear())
  const [mies, setMies] = useState(now.getMonth() + 1)

  const [pracownicy, setPracownicy] = useState<Pracownik[]>([])
  const [wpisy,      setWpisy]      = useState<CzasWpis[]>([])
  const [saved,      setSaved]      = useState<any[]>([])
  const [stawki,     setStawki]     = useState<Stawki>(DEFAULTS)

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [success,  setSuccess]  = useState('')
  const [error,    setError]    = useState('')

  // Pasek wynagrodzeń
  const [paslipId, setPaslipId] = useState<string | null>(null)
  // Panel stawek
  const [showStawki,   setShowStawki]   = useState(false)
  const [stawkiEdit,   setStawkiEdit]   = useState<Record<string,string>>({})
  const [savingStawki, setSavingStawki] = useState(false)

  // Lokalne nadpisania (premia / potrącenia / notatki)
  const [ovr, setOvr] = useState<Record<string, { premia: string; potracenia: string; notatki: string }>>({})

  useEffect(() => { loadAll() }, [rok, mies])

  async function loadAll() {
    setLoading(true)
    const dateOd = `${rok}-${String(mies).padStart(2,'0')}-01`
    const lastDay = new Date(rok, mies, 0).getDate()
    const dateDo  = `${rok}-${String(mies).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`

    const [{ data: pr }, { data: wp }, { data: pl }, { data: stRaw }] = await Promise.all([
      supabase.from('pracownicy')
        .select('id,imie,nazwisko,stanowisko,rodzaj_umowy,wynagrodzenie_brutto,stawka_godzinowa,wymiar_etatu,aktywny')
        .eq('aktywny', true).order('nazwisko'),
      supabase.from('czas_pracy')
        .select('pracownik_id,data,rodzaj,godziny,delegacja,delegacja_stawka')
        .gte('data', dateOd).lte('data', dateDo),
      supabase.from('place').select('*').eq('rok', rok).eq('miesiac', mies),
      supabase.from('place_parametry').select('id,wartosc'),
    ])

    setPracownicy(pr ?? [])
    setWpisy(wp ?? [])
    setSaved(pl ?? [])

    // Stawki z bazy
    if (stRaw && stRaw.length > 0) {
      const s: Stawki = { ...DEFAULTS }
      for (const row of stRaw) s[row.id] = +row.wartosc
      setStawki(s)
      // Init edytor stawek
      const e: Record<string, string> = {}
      for (const row of stRaw) e[row.id] = String(row.wartosc)
      setStawkiEdit(e)
    }

    // Init overrides z zapisanych danych
    const init: typeof ovr = {}
    for (const s of (pl ?? [])) {
      init[s.pracownik_id] = {
        premia:     String(s.premia     ?? 0),
        potracenia: String(s.potracenia ?? 0),
        notatki:    s.notatki ?? '',
      }
    }
    setOvr(init)
    setLoading(false)
  }

  function showMsg(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }

  const robDni = useMemo(() => roboczeDni(rok, mies), [rok, mies])

  function getOvr(pid: string) {
    const s = saved.find(x => x.pracownik_id === pid)
    return ovr[pid] ?? {
      premia:     String(s?.premia     ?? 0),
      potracenia: String(s?.potracenia ?? 0),
      notatki:    s?.notatki ?? '',
    }
  }
  function setOvrField(pid: string, field: 'premia'|'potracenia'|'notatki', val: string) {
    setOvr(o => ({ ...o, [pid]: { ...getOvr(pid), [field]: val } }))
  }

  const naliczenia = useMemo(() =>
    pracownicy.map(p => {
      const o  = getOvr(p.id)
      const sv = saved.find(s => s.pracownik_id === p.id)
      return calcNalic(p, wpisy, robDni, {
        premia:     parseFloat(o.premia)     || 0,
        potracenia: parseFloat(o.potracenia) || 0,
        status:     sv?.status ?? 'projekt',
        notatki:    o.notatki,
      }, stawki)
    }),
  [pracownicy, wpisy, robDni, ovr, saved, stawki])

  // ── Zapis listy płac ────────────────────────────────────────
  async function saveAll() {
    setSaving(true); setError('')
    try {
      for (const p of pracownicy) {
        const n  = naliczenia.find(n => n.pid === p.id)
        if (!n) continue
        const sv = saved.find(s => s.pracownik_id === p.id)
        const payload = {
          pracownik_id: p.id, rok, miesiac: mies,
          godziny_przepracowane: n.godz_praca,
          godziny_nadgodzin:     n.godz_ng,
          dni_urlopu:            Math.round(n.godz_urlop / 8),
          dni_l4:                Math.round(n.godz_l4   / 8),
          dni_nieobecnosci:      Math.round(n.godz_nieob / 8),
          dodatek_delegacja:     n.deleg_kwota,
          premia:                n.premia,
          potracenia:            n.potracenia,
          wynagrodzenie_podstawowe: n.wynagrodzenie_podst,
          wynagrodzenie_brutto:  n.brutto,
          zus_pracownik:         n.zus_prac_total,
          zus_zdrowotna:         n.zus_zdrowotna,
          zaliczka_pit:          n.zaliczka_pit,
          wynagrodzenie_netto:   n.netto,
          zus_pracodawca:        n.zus_pracodawca_total,
          koszt_pracodawcy:      n.koszt_pracodawcy,
          status:                n.status,
          notatki:               n.notatki || null,
          updated_at:            new Date().toISOString(),
        }
        if (sv) {
          await supabase.from('place').update(payload).eq('id', sv.id)
        } else {
          await supabase.from('place').insert(payload)
        }
      }
      showMsg('Lista płac zapisana!')
      loadAll()
    } catch (e: any) {
      setError(e.message ?? 'Błąd zapisu')
    }
    setSaving(false)
  }

  async function changeStatus(pid: string, status: Nalic['status']) {
    const sv = saved.find(s => s.pracownik_id === pid)
    if (!sv) return
    await supabase.from('place').update({ status }).eq('id', sv.id)
    loadAll()
  }

  // ── Zapis stawek ────────────────────────────────────────────
  async function saveStawki() {
    setSavingStawki(true)
    for (const [id, val] of Object.entries(stawkiEdit)) {
      await supabase.from('place_parametry')
        .update({ wartosc: parseFloat(val) || 0, updated_at: new Date().toISOString() })
        .eq('id', id)
    }
    setSavingStawki(false)
    setShowStawki(false)
    loadAll()
    showMsg('Stawki zaktualizowane!')
  }

  // ── Sumy ────────────────────────────────────────────────────
  const suma = useMemo(() => ({
    brutto:  naliczenia.reduce((a, n) => a + n.brutto, 0),
    netto:   naliczenia.reduce((a, n) => a + n.netto,  0),
    zus_prac:     naliczenia.reduce((a, n) => a + n.zus_prac_total, 0),
    zus_pracodawca: naliczenia.reduce((a, n) => a + n.zus_pracodawca_total, 0),
    koszt_pracodawcy: naliczenia.reduce((a, n) => a + n.koszt_pracodawcy, 0),
    premia:  naliczenia.reduce((a, n) => a + n.premia,  0),
    zaliczka_pit: naliczenia.reduce((a, n) => a + n.zaliczka_pit, 0),
    zatw:    saved.filter(s => s.status === 'zatwierdzone').length,
    wypl:    saved.filter(s => s.status === 'wyplacone').length,
  }), [naliczenia, saved])

  const paslipN = paslipId ? naliczenia.find(n => n.pid === paslipId) : null
  const paslipP = paslipId ? pracownicy.find(p => p.id === paslipId)  : null

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">

      {/* ── Nagłówek ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Płace</h1>
          <p className="text-sm text-gray-500 mt-0.5">Naliczanie wynagrodzeń · ZUS · PIT · Nadgodziny · Urlopy · L4 · Delegacje</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={mies} onChange={e => setMies(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none bg-white">
            {MIESIACE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={rok} onChange={e => setRok(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none bg-white w-24">
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <a href="/kadry" className="text-sm border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 text-gray-600">
            👷 Pracownicy
          </a>
          <button onClick={() => setShowStawki(true)}
            className="text-sm border border-gray-200 rounded-lg px-4 py-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-gray-600 transition-colors">
            ⚙️ Stawki ZUS/PIT
          </button>
          <button onClick={saveAll} disabled={saving}
            className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 hover:bg-gray-700 disabled:opacity-50">
            {saving ? 'Zapisuję...' : '💾 Zapisz listę płac'}
          </button>
        </div>
      </div>

      {success && <div className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mb-4">✓ {success}</div>}
      {error   && <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-4">✗ {error}</div>}

      {/* ── Info o miesiącu ──────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 text-xs flex-wrap">
        <span className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-lg font-medium">
          {MIESIACE[mies - 1]} {rok} · {robDni} dni roboczych · norma {robDni * 8} h
        </span>
        <span className="text-gray-500">
          Zatwierdzone: <strong>{suma.zatw}</strong> · Wypłacone: <strong>{suma.wypl}</strong>
        </span>
        <span className="text-xs text-gray-400">
          ZUS prac. {fmtPct(((stawki.zus_em_prac??0)+(stawki.zus_rent_prac??0)+(stawki.zus_choro_prac??0)))} ·
          PIT I próg {fmtPct(stawki.pit_prog1??12)} · ulga {fmt(r2((stawki.pit_kwota_wolna??30000)*(stawki.pit_prog1??12)/100/12))} zł/mies
        </span>
      </div>

      {/* ── KPI ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { l: 'Łączne brutto',        v: fmt(suma.brutto) + ' zł',          cls: 'text-gray-900'   },
          { l: 'Łączne netto',         v: fmt(suma.netto)  + ' zł',          cls: 'text-green-700'  },
          { l: 'ZUS pracownicy',       v: fmt(suma.zus_prac) + ' zł',        cls: 'text-orange-600' },
          { l: 'Zaliczki PIT',         v: fmt(suma.zaliczka_pit) + ' zł',    cls: 'text-red-600'    },
          { l: 'Koszt pracodawcy',     v: fmt(suma.koszt_pracodawcy) + ' zł',cls: 'text-purple-700' },
        ].map(k => (
          <div key={k.l} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{k.l}</p>
            <p className={`text-lg font-semibold ${k.cls}`}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* ── Tabela ──────────────────────────────────────────── */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Ładowanie danych...</p>
      ) : pracownicy.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400">
            Brak aktywnych pracowników. <a href="/kadry" className="text-blue-600 hover:underline">Przejdź do Kadry →</a>
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left   text-xs font-medium text-gray-500 px-4 py-3 min-w-40">Pracownik</th>
                <th className="text-right  text-xs font-medium text-gray-500 px-2 py-3 min-w-16">Godz.</th>
                <th className="text-right  text-xs font-medium text-gray-500 px-2 py-3 min-w-16">NG</th>
                <th className="text-right  text-xs font-medium text-gray-500 px-2 py-3 min-w-14">URL</th>
                <th className="text-right  text-xs font-medium text-gray-500 px-2 py-3 min-w-12">L4</th>
                <th className="text-right  text-xs font-medium text-gray-500 px-2 py-3 min-w-20">Deleg.</th>
                <th className="text-center text-xs font-medium text-gray-500 px-2 py-3 min-w-24">Premia [zł]</th>
                <th className="text-center text-xs font-medium text-gray-500 px-2 py-3 min-w-24">Potrąc. [zł]</th>
                <th className="text-right  text-xs font-medium text-gray-500 px-3 py-3 min-w-28 bg-amber-50">Brutto</th>
                <th className="text-right  text-xs font-medium text-gray-500 px-2 py-3 min-w-24">ZUS prac.</th>
                <th className="text-right  text-xs font-medium text-gray-500 px-2 py-3 min-w-20">PIT</th>
                <th className="text-right  text-xs font-medium text-gray-500 px-3 py-3 min-w-28 bg-green-50">Netto</th>
                <th className="text-right  text-xs font-medium text-gray-500 px-2 py-3 min-w-28 bg-purple-50">Koszt pracodawcy</th>
                <th className="text-center text-xs font-medium text-gray-500 px-2 py-3 min-w-28">Status</th>
                <th className="text-center text-xs font-medium text-gray-500 px-2 py-3 min-w-12">📄</th>
              </tr>
            </thead>
            <tbody>
              {pracownicy.map((p, idx) => {
                const n  = naliczenia.find(n => n.pid === p.id)
                if (!n) return null
                const o  = getOvr(p.id)
                const sv = saved.find(s => s.pracownik_id === p.id)
                return (
                  <tr key={p.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.imie} {p.nazwisko}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1.5">
                        <span>{p.stanowisko}</span>
                        {(p.wymiar_etatu ?? 1) < 1 && (
                          <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded font-medium">
                            {wymiarLabel(p.wymiar_etatu)}
                          </span>
                        )}
                      </div>
                      {n.godz_praca === 0 && n.godz_urlop === 0 && n.godz_l4 === 0 && (
                        <div className="text-xs text-amber-600 mt-0.5">⚠ brak wpisów czasu pracy</div>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right font-medium text-gray-700 text-xs">{n.godz_praca}h</td>
                    <td className="px-2 py-3 text-right text-xs">
                      {n.godz_ng > 0 ? <span className="text-green-700 font-medium">{n.godz_ng}h</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-2 py-3 text-right text-xs">
                      {n.godz_urlop > 0 ? <span className="text-purple-700">{Math.round(n.godz_urlop/8)}d</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-2 py-3 text-right text-xs">
                      {n.godz_l4 > 0 ? <span className="text-red-600">{Math.round(n.godz_l4/8)}d</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-2 py-3 text-right text-xs">
                      {n.deleg_kwota > 0 ? <span className="text-orange-700 font-medium">{fmt(n.deleg_kwota)} zł</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-2 py-3">
                      <input type="number" min="0" step="0.01" value={o.premia}
                        onChange={e => setOvrField(p.id, 'premia', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" placeholder="0" />
                    </td>
                    <td className="px-2 py-3">
                      <input type="number" min="0" step="0.01" value={o.potracenia}
                        onChange={e => setOvrField(p.id, 'potracenia', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" placeholder="0" />
                    </td>
                    <td className="px-3 py-3 text-right bg-amber-50/40">
                      <span className="font-bold text-gray-900">{fmt(n.brutto)} zł</span>
                    </td>
                    <td className="px-2 py-3 text-right text-xs">
                      <span className="text-orange-700">{fmt(n.zus_prac_total)} zł</span>
                    </td>
                    <td className="px-2 py-3 text-right text-xs">
                      <span className="text-red-600">{fmt(n.zaliczka_pit)} zł</span>
                    </td>
                    <td className="px-3 py-3 text-right bg-green-50/40">
                      <span className="font-bold text-green-700">{fmt(n.netto)} zł</span>
                    </td>
                    <td className="px-2 py-3 text-right bg-purple-50/40">
                      <span className="font-medium text-purple-700 text-xs">{fmt(n.koszt_pracodawcy)} zł</span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      {sv ? (
                        <select value={n.status}
                          onChange={e => changeStatus(p.id, e.target.value as Nalic['status'])}
                          className={`text-xs px-2 py-1 rounded-full font-medium cursor-pointer border-0 ${STATUS_BADGE[n.status]}`}>
                          <option value="projekt">Projekt</option>
                          <option value="zatwierdzone">Zatwierdzone</option>
                          <option value="wyplacone">Wypłacone</option>
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400">niezapisane</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button onClick={() => setPaslipId(p.id)}
                        className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-blue-50 hover:text-blue-700 text-gray-400 transition-colors">
                        📄
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={8} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Suma miesiąca</td>
                <td className="px-3 py-3 text-right font-bold text-gray-900 bg-amber-50/60">{fmt(suma.brutto)} zł</td>
                <td className="px-2 py-3 text-right font-semibold text-orange-700 text-xs">{fmt(suma.zus_prac)} zł</td>
                <td className="px-2 py-3 text-right font-semibold text-red-600 text-xs">{fmt(suma.zaliczka_pit)} zł</td>
                <td className="px-3 py-3 text-right font-bold text-green-700 bg-green-50/60">{fmt(suma.netto)} zł</td>
                <td className="px-2 py-3 text-right font-bold text-purple-700 text-xs bg-purple-50/60">{fmt(suma.koszt_pracodawcy)} zł</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="mt-2 text-xs text-gray-400">
        ℹ️ Kalkulacja wg przepisów 2026: ZUS prac. 13,71% | zdrowotna 9% | PIT 12% (I próg) | ulga podatkowa {fmt(r2((stawki.pit_kwota_wolna??30000)*(stawki.pit_prog1??12)/100/12))} zł/mies | L4 {stawki.l4_procent??80}% · Nadgodziny 150% · Nieobecność nkw. = 0 zł. Dokument pomocniczy — skonsultuj z biurem rachunkowym.
      </p>

      {/* ================================================================
          PANEL: Stawki ZUS / PIT
      ================================================================ */}
      {showStawki && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black bg-opacity-40" onClick={() => setShowStawki(false)} />
          <div className="w-full max-w-lg bg-white border-l border-gray-200 flex flex-col" style={{ overflowY:'auto' }}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">⚙️ Stawki ZUS i PIT</h2>
                <p className="text-xs text-gray-500 mt-0.5">Aktualizowane zmiany są zapisywane w bazie i obowiązują od razu.</p>
              </div>
              <button onClick={() => setShowStawki(false)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="flex-1 p-5 space-y-6 overflow-y-auto">
              {KATEGORIE_STAWEK.map(kat => (
                <div key={kat.id}>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100">{kat.label}</h3>
                  <div className="space-y-2">
                    {kat.pola.map(pole => (
                      <div key={pole.id} className="flex items-center justify-between gap-4">
                        <label className="text-sm text-gray-700 flex-1">{pole.label}</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number" step="0.01" min="0"
                            value={stawkiEdit[pole.id] ?? String(stawki[pole.id] ?? '')}
                            onChange={e => setStawkiEdit(s => ({ ...s, [pole.id]: e.target.value }))}
                            className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Podgląd łącznych obciążeń */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs space-y-1">
                <p className="font-semibold text-gray-700 mb-2">Łączne obciążenia (podgląd):</p>
                {[
                  ['ZUS pracownik łącznie',   ((parseFloat(stawkiEdit.zus_em_prac)||stawki.zus_em_prac||0)+(parseFloat(stawkiEdit.zus_rent_prac)||stawki.zus_rent_prac||0)+(parseFloat(stawkiEdit.zus_choro_prac)||stawki.zus_choro_prac||0)).toFixed(2)+'%'],
                  ['Zdrowotna',               (parseFloat(stawkiEdit.zus_zdrowotna)||stawki.zus_zdrowotna||9).toFixed(2)+'% (od podstawy)'],
                  ['ZUS pracodawca łącznie',  ((parseFloat(stawkiEdit.zus_em_pracodawca)||stawki.zus_em_pracodawca||0)+(parseFloat(stawkiEdit.zus_rent_pracodawca)||stawki.zus_rent_pracodawca||0)+(parseFloat(stawkiEdit.zus_wypadkowa)||stawki.zus_wypadkowa||0)+(parseFloat(stawkiEdit.fp)||stawki.fp||0)+(parseFloat(stawkiEdit.fgssp)||stawki.fgssp||0)).toFixed(2)+'%'],
                  ['Ulga podatkowa/mies.',    fmt(r2((parseFloat(stawkiEdit.pit_kwota_wolna)||stawki.pit_kwota_wolna||30000)*(parseFloat(stawkiEdit.pit_prog1)||stawki.pit_prog1||12)/100/12))+' zł'],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between">
                    <span className="text-gray-500">{l}</span>
                    <span className="font-medium text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-2">
              <button onClick={() => setShowStawki(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={saveStawki} disabled={savingStawki}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {savingStawki ? 'Zapisuję...' : '💾 Zapisz stawki'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL: Pasek wynagrodzeń
      ================================================================ */}
      {paslipId && paslipN && paslipP && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-sm flex flex-col" style={{ maxHeight:'94vh', overflowY:'auto' }}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Pasek wynagrodzenia</h2>
              <button onClick={() => setPaslipId(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            <div className="p-5 text-sm space-y-1">
              {/* Nagłówek pracownika */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-gray-900 text-base">{paslipP.imie} {paslipP.nazwisko}</p>
                  <p className="text-xs text-gray-500">{paslipP.stanowisko}</p>
                </div>
                <div className="text-right text-xs text-gray-400">
                  <p className="font-medium">{MIESIACE[mies-1]} {rok}</p>
                  <p>{robDni} dni rob.</p>
                  <p className="font-medium text-gray-600">
                    {wymiarLabel(paslipP.wymiar_etatu)} · norma {Math.round(robDni * 8 * (paslipP.wymiar_etatu ?? 1))}h
                  </p>
                </div>
              </div>

              {/* Czas pracy */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-1 mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Czas pracy</p>
                <Row l="Przepracowane" v={`${paslipN.godz_praca} h`} />
                {paslipN.godz_ng     > 0 && <Row l="Nadgodziny (×1,5)"       v={`${paslipN.godz_ng} h`}             cls="text-green-700" />}
                {paslipN.godz_urlop  > 0 && <Row l="Urlop wypoczynkowy"       v={`${Math.round(paslipN.godz_urlop/8)} dni`} cls="text-purple-700" />}
                {paslipN.godz_l4     > 0 && <Row l={`L4 (${stawki.l4_procent??80}% stawki)`} v={`${Math.round(paslipN.godz_l4/8)} dni`} cls="text-red-600" />}
                {paslipN.godz_nieob  > 0 && <Row l="Nieobecność nkw. (0 zł)" v={`${Math.round(paslipN.godz_nieob/8)} dni`} cls="text-orange-600" />}
                {paslipN.godz_szkol  > 0 && <Row l="Szkolenie"                v={`${paslipN.godz_szkol} h`}         cls="text-blue-600" />}
              </div>

              {/* Składniki wynagrodzenia */}
              <div className="space-y-1 mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Składniki wynagrodzenia</p>
                <Row l="Wynagrodzenie podstawowe" v={fmt(paslipN.wynagrodzenie_podst)+' zł'} />
                {paslipN.deleg_kwota > 0 && <Row l="Diety delegacyjne"        v={`+ ${fmt(paslipN.deleg_kwota)} zł`} cls="text-orange-700" />}
                {paslipN.premia      > 0 && <Row l="Premia"                   v={`+ ${fmt(paslipN.premia)} zł`}      cls="text-purple-700" />}
                {paslipN.potracenia  > 0 && <Row l="Potrącenia"               v={`− ${fmt(paslipN.potracenia)} zł`}  cls="text-red-600" />}
                <div className="border-t border-gray-200 pt-1 flex justify-between font-bold text-gray-900">
                  <span>BRUTTO</span><span>{fmt(paslipN.brutto)} zł</span>
                </div>
              </div>

              {/* ZUS pracownika */}
              <div className="bg-orange-50 rounded-xl p-3 space-y-1 mb-3">
                <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-2">ZUS pracownika</p>
                <Row l={`Emerytalna ${fmtPct(stawki.zus_em_prac??9.76)}`}    v={`− ${fmt(paslipN.zus_em_prac)} zł`}    cls="text-orange-700" />
                <Row l={`Rentowa ${fmtPct(stawki.zus_rent_prac??1.50)}`}     v={`− ${fmt(paslipN.zus_rent_prac)} zł`}   cls="text-orange-700" />
                <Row l={`Chorobowa ${fmtPct(stawki.zus_choro_prac??2.45)}`}  v={`− ${fmt(paslipN.zus_choro_prac)} zł`}  cls="text-orange-700" />
                <div className="border-t border-orange-200 pt-1 flex justify-between text-xs font-semibold text-orange-800">
                  <span>Łącznie ZUS</span><span>− {fmt(paslipN.zus_prac_total)} zł</span>
                </div>
              </div>

              {/* Zdrowotna + PIT */}
              <div className="bg-red-50 rounded-xl p-3 space-y-1 mb-3">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">Zdrowotna i podatek</p>
                <Row l={`Składka zdrowotna ${fmtPct(stawki.zus_zdrowotna??9)}`}
                     v={`− ${fmt(paslipN.zus_zdrowotna)} zł`} cls="text-red-600"
                     sub={`od podstawy ${fmt(paslipN.podstawa_zdrowotna)} zł`} />
                <Row l={`Podstawa PIT (po KUP ${fmt(stawki.kup??250)} zł)`}
                     v={`${fmt(paslipN.podstawa_pit)} zł`} cls="text-gray-600" />
                <Row l={`Podatek ${fmtPct(stawki.pit_prog1??12)}`}
                     v={`${fmt(paslipN.podatek_brutto)} zł`} cls="text-red-600" />
                <Row l="− Ulga podatkowa"
                     v={`− ${fmt(paslipN.ulga_pit)} zł`} cls="text-green-700" />
                <div className="border-t border-red-200 pt-1 flex justify-between text-xs font-semibold text-red-800">
                  <span>Zaliczka PIT</span><span>− {fmt(paslipN.zaliczka_pit)} zł</span>
                </div>
              </div>

              {/* Netto */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
                <div className="flex justify-between font-bold text-xl text-green-700">
                  <span>DO WYPŁATY (NETTO)</span><span>{fmt(paslipN.netto)} zł</span>
                </div>
              </div>

              {/* Koszt pracodawcy */}
              <div className="bg-purple-50 rounded-xl p-3 space-y-1">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">Koszt pracodawcy</p>
                <Row l="Wynagrodzenie brutto"                                             v={`${fmt(paslipN.brutto)} zł`} />
                <Row l={`Emerytalna ${fmtPct(stawki.zus_em_pracodawca??9.76)}`}          v={`+ ${fmt(paslipN.zus_em_pracodawca)} zł`}   cls="text-purple-700" />
                <Row l={`Rentowa ${fmtPct(stawki.zus_rent_pracodawca??6.50)}`}           v={`+ ${fmt(paslipN.zus_rent_pracodawca)} zł`}  cls="text-purple-700" />
                <Row l={`Wypadkowe ${fmtPct(stawki.zus_wypadkowa??1.67)}`}               v={`+ ${fmt(paslipN.zus_wypadkowa)} zł`}        cls="text-purple-700" />
                <Row l={`FP ${fmtPct(stawki.fp??2.45)}`}                                 v={`+ ${fmt(paslipN.fp)} zł`}                   cls="text-purple-700" />
                <Row l={`FGŚP ${fmtPct(stawki.fgssp??0.10)}`}                           v={`+ ${fmt(paslipN.fgssp)} zł`}                cls="text-purple-700" />
                <div className="border-t border-purple-200 pt-1 flex justify-between font-bold text-purple-900">
                  <span>Łączny koszt pracodawcy</span><span>{fmt(paslipN.koszt_pracodawcy)} zł</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => setPaslipId(null)}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Zamknij</button>
              <button onClick={() => window.print()}
                className="flex-1 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700">🖨️ Drukuj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Pomocniczy wiersz paska
function Row({ l, v, cls = 'text-gray-700', sub }: { l: string; v: string; cls?: string; sub?: string }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <div className="flex-1">
        <span className="text-xs text-gray-600">{l}</span>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${cls}`}>{v}</span>
    </div>
  )
}
