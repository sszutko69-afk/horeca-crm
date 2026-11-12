import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Regulamin — Skrojo',
  description: 'Regulamin świadczenia usługi Skrojo: okres próbny, wersja podstawowa, subskrypcja.',
}

const KONTAKT = 'skrojocrm@gmail.com'

function P({ n, t, children }: { n: number; t: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 space-y-3 text-gray-700 text-[15px] leading-relaxed">
      <h2 className="text-lg font-medium text-gray-900">§ {n}. {t}</h2>
      {children}
    </section>
  )
}

export default function Regulamin() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <article className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 md:p-12">
        <h1 className="text-2xl font-semibold text-gray-900">Regulamin usługi Skrojo</h1>
        <p className="text-sm text-gray-500 mt-2">Wersja 2026-11 · obowiązuje od 12 listopada 2026</p>
        <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
          Dokument roboczy: przed uruchomieniem publicznym zalecamy weryfikację przez prawnika (m.in. prawo odstąpienia, zasady
          reklamacji, odpowiedzialność, umowa powierzenia danych).
        </p>

        <P n={1} t="Usługodawca i usługa">
          <p>
            Usługę Skrojo (system CRM dostępny przez przeglądarkę) świadczy ON Gaz Sp. z o.o., 02-577 Warszawa, Al. Niepodległości 118A
            lok. 19, NIP 5213917162 (dalej: Usługodawca). Kontakt: <a href={`mailto:${KONTAKT}`} className="text-blue-600 hover:underline">{KONTAKT}</a>.
          </p>
        </P>
        <P n={2} t="Konto i aktywacja">
          <p>
            Konto zakłada przedsiębiorca lub osoba działająca w jego imieniu. Loginem jest adres e-mail. Konto staje się aktywne po
            kliknięciu linku aktywacyjnego wysłanego na ten adres. Użytkownik odpowiada za poufność hasła i za działania osób, którym
            nadał dostęp.
          </p>
        </P>
        <P n={3} t="Okres próbny i wersja podstawowa">
          <ul className="list-disc pl-6 space-y-2">
            <li>Po aktywacji konta system działa w <strong>pełnej wersji przez 7 dni</strong>, bez konieczności podawania danych płatniczych.</li>
            <li>Po tym okresie system przechodzi do <strong>wersji podstawowej, bezpłatnej bez limitu czasu</strong>. Dane wprowadzone w okresie próbnym są zachowane; moduły rozszerzone przestają być dostępne do czasu wykupienia subskrypcji.</li>
            <li>Użytkownik może wykupić subskrypcję lub skontaktować się z zespołem Skrojo w celu dopasowania systemu do swoich potrzeb.</li>
          </ul>
        </P>
        <P n={4} t="Subskrypcja i płatności">
          <ul className="list-disc pl-6 space-y-2">
            <li>Moduły rozszerzone są dostępne w abonamencie miesięcznym od 29 zł (cena i zakres wyświetlane są przed zakupem). Subskrypcja odnawia się automatycznie co miesiąc do czasu wypowiedzenia.</li>
            <li>Płatności obsługuje Stripe. Dane karty nie trafiają do Usługodawcy.</li>
            <li>Subskrypcję można anulować w dowolnym momencie w panelu subskrypcji; pozostaje aktywna do końca opłaconego okresu.</li>
            <li>Brak płatności skutkuje przejściem do wersji podstawowej.</li>
          </ul>
        </P>
        <P n={5} t="Dane klienta">
          <p>
            Dane wprowadzone do systemu pozostają własnością klienta. Usługodawca przetwarza je wyłącznie w celu świadczenia usługi.
            Administrator firmy może w każdej chwili wyeksportować dane lub usunąć konto wraz z danymi firmy. Szczegóły:{' '}
            <a href="/polityka-prywatnosci" className="text-blue-600 hover:underline">polityka prywatności</a>.
          </p>
        </P>
        <P n={6} t="Zasady korzystania">
          <p>Zabronione jest m.in. przesyłanie treści niezgodnych z prawem, próby obejścia zabezpieczeń, dostęp do danych innych firm oraz nadmierne obciążanie systemu automatami.</p>
        </P>
        <P n={7} t="Odpowiedzialność i reklamacje">
          <p>
            Usługodawca dokłada starań, aby usługa działała nieprzerwanie, nie gwarantuje jednak braku przerw technicznych. Reklamacje
            można zgłaszać na adres {KONTAKT}; odpowiadamy w ciągu 14 dni.
          </p>
        </P>
        <P n={8} t="Zmiany regulaminu">
          <p>O zmianach regulaminu informujemy z wyprzedzeniem na adres e-mail konta lub w aplikacji. Dalsze korzystanie po wejściu zmian w życie oznacza ich akceptację.</p>
        </P>

        <p className="mt-10 pt-6 border-t border-gray-100 text-sm text-gray-400">
          <a href="/polityka-prywatnosci" className="text-blue-600 hover:underline">Polityka prywatności</a> · <a href="/rejestracja" className="text-blue-600 hover:underline">Rejestracja</a>
        </p>
      </article>
    </main>
  )
}
