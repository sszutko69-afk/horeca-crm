import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GazCRM — system zarządzania firmą gazową',
  description: 'GazCRM: klienci, sprzedaż LPG, rozliczenia EDD, inwestycje i monitoring przetargów w jednym miejscu.',
}

const MODULY = [
  { nazwa: 'Klienci i CRM',        opis: 'Baza klientów, kontakty, leady i historia współpracy.' },
  { nazwa: 'Zakupy i sprzedaż LPG', opis: 'Ewidencja partii, rozliczenia dokumentów akcyzowych EDD, raporty dobowe.' },
  { nazwa: 'Dostawy i trasy',       opis: 'Zamówienia, planowanie dostaw cysterną, rozliczenie realizacji.' },
  { nazwa: 'Inwestycje',            opis: 'Projekty budowlane, kosztorysy KNR, etapy i czas pracy.' },
  { nazwa: 'Przetargi',             opis: 'Monitoring ogłoszeń z BZP oraz platform zakupowych, archiwum postępowań.' },
  { nazwa: 'Integracje',            opis: 'Gmail, Kalendarz i Zadania Google, księgowość, kopie zapasowe.' },
]

export default function OAplikacji() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">

        <header className="bg-white border border-gray-200 rounded-2xl p-8 md:p-12">
          <p className="text-xs font-medium tracking-wide text-blue-600 uppercase">ON GAZ Sp. z o.o.</p>
          <h1 className="text-3xl font-semibold text-gray-900 mt-2">GazCRM</h1>
          <p className="text-gray-600 mt-3 text-[15px] leading-relaxed">
            Wewnętrzny system zarządzania firmą gazową — od ewidencji sprzedaży LPG i rozliczeń akcyzowych,
            przez inwestycje budowlane, po monitoring ogłoszeń przetargowych. Z aplikacji korzystają
            wyłącznie upoważnieni pracownicy spółki.
          </p>
          <a href="/login"
            className="inline-block mt-6 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 text-sm font-medium">
            Zaloguj się
          </a>
        </header>

        <section className="grid gap-3 md:grid-cols-2 mt-6">
          {MODULY.map(m => (
            <div key={m.nazwa} className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-medium text-gray-900 text-sm">{m.nazwa}</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{m.opis}</p>
            </div>
          ))}
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-8 mt-6">
          <h2 className="text-lg font-medium text-gray-900">Dane z konta Google</h2>
          <p className="text-gray-600 mt-2 text-[15px] leading-relaxed">
            Po wyrażeniu zgody aplikacja czyta wiadomości oznaczone w Gmailu etykietą „Przetargi", aby
            rozpoznać w nich ogłoszenia i zapisać je w bazie, oraz synchronizuje wydarzenia i zadania
            z Kalendarzem i Zadaniami Google. Dane te nie są sprzedawane, przekazywane podmiotom trzecim
            ani wykorzystywane do reklam. Szczegóły opisuje{' '}
            <a href="/polityka-prywatnosci" className="text-blue-600 hover:underline">polityka prywatności</a>.
          </p>
        </section>

        <footer className="mt-6 px-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
          <a href="/polityka-prywatnosci" className="text-blue-600 hover:underline">Polityka prywatności</a>
          <a href="mailto:sszutko69@gmail.com" className="text-blue-600 hover:underline">Kontakt</a>
          <span>ON GAZ Sp. z o.o., NIP 5213917162</span>
        </footer>

      </div>
    </main>
  )
}
