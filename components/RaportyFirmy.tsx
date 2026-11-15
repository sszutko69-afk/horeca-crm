'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Sprz = { data: string; klient: string; brutto: number; platnosc: string; status: string }
type Zak = { data: string; kategoria: string; brutto: number }

const fmt = (n: number) => n.toLocaleString('pl-PL', { maximumFractionDigits: 0 }) + ' zł'
const MIES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
const PLAT: Record<string, string> = { przelew: 'Przelew', karta: 'Karta', gotowka: 'Gotówka' }

// Raporty liczone z prawdziwych danych firmy (sprzedaż i zakupy zapisane w bazie).
export default function RaportyFirmy() {
  const supabase = createClient()
  const [sprz, setSprz] = useState<Sprz[]>([])
  const [zak, setZak] = useState<Zak[]>([])
  const [loading, setLoading] = useState(true)
  const [blad, setBlad] = useState('')

  useEffect(() => {
    ;(async () => {
      const [a, b] = await Promise.all([
        supabase.from('sprzedaz').select('data_sprzedazy,kwota_brutto,forma_platnosci,status,klient_nazwa,klienci(nazwa)').limit(5000),
        supabase.from('zakupy').select('data_zakupu,kategoria,wartosc_brutto').limit(5000),
      ])
      if (a.error || b.error) { setBlad((a.error ?? b.error)!.message); setLoading(false); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSprz((a.data ?? []).map((r: any) => ({ data: r.data_sprzedazy ?? '', klient: r.klienci?.nazwa ?? r.klient_nazwa ?? '(bez nazwy)', brutto: Number(r.kwota_brutto ?? 0), platnosc: r.forma_platnosci ?? '', status: r.status ?? '' })))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setZak((b.data ?? []).map((r: any) => ({ data: r.data_zakupu ?? '', kategoria: r.kategoria ?? 'Inne', brutto: Number(r.wartosc_brutto ?? 0) })))
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dane = useMemo(() => {
    const przychod = sprz.reduce((s, x) => s + x.brutto, 0)
    const koszty = zak.reduce((s, x) => s + x.brutto, 0)
    const naMiesiace: { k: string; label: string; sprz: number; zak: number }[] = []
    const teraz = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(teraz.getFullYear(), teraz.getMonth() - i, 1)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      naMiesiace.push({
        k, label: `${MIES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        sprz: sprz.filter(x => x.data.startsWith(k)).reduce((s, x) => s + x.brutto, 0),
        zak: zak.filter(x => x.data.startsWith(k)).reduce((s, x) => s + x.brutto, 0),
      })
    }
    const poPlat = new Map<string, number>()
    sprz.forEach(x => poPlat.set(x.platnosc || 'inne', (poPlat.get(x.platnosc || 'inne') ?? 0) + x.brutto))
    const poKlientach = new Map<string, number>()
    sprz.forEach(x => poKlientach.set(x.klient, (poKlientach.get(x.klient) ?? 0) + x.brutto))
    const poKat = new Map<string, number>()
    zak.forEach(x => poKat.set(x.kategoria, (poKat.get(x.kategoria) ?? 0) + x.brutto))
    const top = (m: Map<string, number>, n: number) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n)
    return { przychod, koszty, marza: przychod - koszty, naMiesiace, platnosci: top(poPlat, 6), klienci: top(poKlientach, 5), kategorie: top(poKat, 6),
      zalegle: sprz.filter(x => x.status === 'zalegla').reduce((s, x) => s + x.brutto, 0) }
  }, [sprz, zak])

  if (loading) return <div className="p-6 text-sm text-gray-400">Wczytywanie raportów…</div>
  if (blad) return <div className="p-6 text-sm text-red-600">Nie udało się wczytać danych: {blad}</div>
  if (sprz.length === 0 && zak.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-3xl">
        <h1 className="text-xl font-medium text-gray-900">Raporty</h1>
        <div className="mt-5 bg-white border border-gray-200 rounded-xl p-6 text-center">
          <p className="text-3xl">📊</p>
          <p className="font-medium text-gray-900 mt-2">Raporty pojawią się, gdy w systemie będą dane</p>
          <p className="text-sm text-gray-500 mt-1">Dodaj sprzedaż i zakupy, a zestawienia dla Twojej firmy będą dostępne tutaj. Dodatkowe raporty dopasujemy do Twoich potrzeb: skrojocrm@gmail.com.</p>
        </div>
      </div>
    )
  }

  const maks = Math.max(1, ...dane.naMiesiace.flatMap(m => [m.sprz, m.zak]))
  const Lista = ({ t, rows }: { t: string; rows: [string, number][] }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="font-medium text-gray-900 text-sm">{t}</p>
      {rows.length === 0 ? <p className="text-xs text-gray-400 mt-2">Brak danych.</p> : (
        <table className="mt-2 w-full text-sm"><tbody>
          {rows.map(([k, v]) => <tr key={k} className="border-t border-gray-100"><td className="py-1.5 text-gray-700">{PLAT[k] ?? k}</td><td className="py-1.5 text-right font-medium">{fmt(v)}</td></tr>)}
        </tbody></table>
      )}
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <h1 className="text-xl font-medium text-gray-900">Raporty</h1>
      <p className="text-sm text-gray-500 mt-0.5">Zestawienia liczone z danych Twojej firmy (sprzedaż i zakupy)</p>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { t: 'Przychód brutto', v: fmt(dane.przychod), c: '#2563EB' },
          { t: 'Koszty zakupów', v: fmt(dane.koszty), c: '#d97706' },
          { t: 'Marża brutto', v: fmt(dane.marza), c: dane.marza >= 0 ? '#16a34a' : '#dc2626' },
          { t: 'Zaległe należności', v: fmt(dane.zalegle), c: '#dc2626' },
        ].map(k => (
          <div key={k.t} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">{k.t}</p>
            <p className="text-lg font-bold mt-1" style={{ color: k.c }}>{k.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
        <p className="font-medium text-gray-900 text-sm">Sprzedaż i zakupy: ostatnie 6 miesięcy</p>
        <div className="mt-3 flex items-end gap-4 h-40">
          {dane.naMiesiace.map(m => (
            <div key={m.k} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="flex items-end gap-1 w-full justify-center flex-1">
                <div title={`Sprzedaż: ${fmt(m.sprz)}`} className="w-1/3 bg-blue-500 rounded-t" style={{ height: `${Math.max(m.sprz ? 4 : 1, (m.sprz / maks) * 100)}%`, opacity: m.sprz ? 1 : 0.2 }} />
                <div title={`Zakupy: ${fmt(m.zak)}`} className="w-1/3 bg-amber-400 rounded-t" style={{ height: `${Math.max(m.zak ? 4 : 1, (m.zak / maks) * 100)}%`, opacity: m.zak ? 1 : 0.2 }} />
              </div>
              <span className="text-[11px] text-gray-500 mt-1">{m.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-2"><span className="inline-block w-2 h-2 bg-blue-500 rounded-sm mr-1" />sprzedaż <span className="inline-block w-2 h-2 bg-amber-400 rounded-sm mx-1 ml-3" />zakupy</p>
      </div>

      <div className="mt-4 grid md:grid-cols-3 gap-4">
        <Lista t="Najwięksi klienci" rows={dane.klienci} />
        <Lista t="Sprzedaż wg formy płatności" rows={dane.platnosci} />
        <Lista t="Zakupy wg kategorii" rows={dane.kategorie} />
      </div>
    </div>
  )
}
