import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Polityka prywatności — Skrojo',
  description: 'Jak Skrojo przetwarza dane osobowe i dane płatnicze.',
}

const AKTUALIZACJA = '12 listopada 2026'
const KONTAKT = 'skrojocrm@gmail.com'

function Sekcja({ n, t, children }: { n: number; t: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 space-y-3 text-gray-700 text-[15px] leading-relaxed">
      <h2 className="text-lg font-medium text-gray-900">{n}. {t}</h2>
      {children}
    </section>
  )
}

export default function PolitykaPrywatnosci() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <article className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 md:p-12">
        <h1 className="text-2xl font-semibold text-gray-900">Polityka prywatności Skrojo</h1>
        <p className="text-sm text-gray-500 mt-2">Ostatnia aktualizacja: {AKTUALIZACJA}</p>

        <Sekcja n={1} t="Administrator danych">
          <p>
            Administratorem danych osobowych osób zakładających konto i korzystających z serwisu Skrojo jest{' '}
            <strong>ON Gaz Sp. z o.o.</strong>, 02-577 Warszawa, Al. Niepodległości 118A lok. 19, NIP 5213917162.
            Kontakt w sprawach danych osobowych: <a href={`mailto:${KONTAKT}`} className="text-blue-600 hover:underline">{KONTAKT}</a>.
          </p>
          <p>
            Dane, które klient wprowadza do systemu (np. własnych kontrahentów, pracowników, rezerwacje), przetwarzamy
            wyłącznie w jego imieniu i na jego polecenie, jako podmiot przetwarzający. Na życzenie zawieramy umowę
            powierzenia przetwarzania danych (art. 28 RODO).
          </p>
        </Sekcja>

        <Sekcja n={2} t="Jakie dane i po co">
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Konto:</strong> adres e-mail (login), imię i nazwisko, nazwa firmy, zaszyfrowane hasło. Podstawa: umowa o świadczenie usługi (art. 6 ust. 1 lit. b RODO).</li>
            <li><strong>Aktywacja i powiadomienia systemowe:</strong> wysyłamy wiadomość z linkiem aktywacyjnym, wiadomości o zmianie hasła, końcu okresu próbnego i płatnościach. Podstawa: umowa.</li>
            <li><strong>Rozliczenia:</strong> dane do faktury i informacje o subskrypcji. Podstawa: obowiązek prawny (przepisy podatkowe i o rachunkowości), art. 6 ust. 1 lit. c RODO.</li>
            <li><strong>Marketing:</strong> informacje o nowościach i ofertach, tylko po wyrażeniu odrębnej, dobrowolnej zgody (art. 6 ust. 1 lit. a RODO). Zgodę można cofnąć w każdej chwili, pisząc na adres kontaktowy.</li>
            <li><strong>Bezpieczeństwo:</strong> dzienniki logowania i adresy IP w celu ochrony systemu (uzasadniony interes, art. 6 ust. 1 lit. f RODO).</li>
          </ul>
        </Sekcja>

        <Sekcja n={3} t="Dane płatnicze">
          <p>
            Płatności za subskrypcję obsługuje operator <strong>Stripe Payments Europe, Ltd.</strong> Numer karty i inne
            dane płatnicze wpisujesz wyłącznie na zabezpieczonej stronie Stripe. <strong>Skrojo nie widzi, nie przetwarza
            i nie przechowuje danych kart płatniczych.</strong> Otrzymujemy tylko informację o statusie płatności i subskrypcji
            oraz identyfikatory techniczne klienta w Stripe.
          </p>
        </Sekcja>

        <Sekcja n={4} t="Odbiorcy danych">
          <p>Dane powierzamy wyłącznie dostawcom niezbędnym do działania usługi, na podstawie umów powierzenia:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Supabase (baza danych i uwierzytelnianie, region UE),</li>
            <li>Vercel (hosting aplikacji),</li>
            <li>Resend (wysyłka wiadomości e-mail),</li>
            <li>Stripe (płatności).</li>
          </ul>
          <p>Dane nie są sprzedawane ani wykorzystywane do reklam. Jeśli dostawca przetwarza dane poza EOG, odbywa się to na podstawie standardowych klauzul umownych.</p>
        </Sekcja>

        <Sekcja n={5} t="Izolacja i bezpieczeństwo danych">
          <p>
            Każda firma ma oddzielną przestrzeń danych. Dostęp jest egzekwowany na poziomie bazy danych (Row Level Security):
            użytkownik widzi wyłącznie dane własnej firmy. Połączenia są szyfrowane (TLS), hasła są przechowywane w postaci
            zaszyfrowanej (hash), a uprawnienia użytkowników nadaje administrator firmy.
          </p>
        </Sekcja>

        <Sekcja n={6} t="Okres przechowywania">
          <p>
            Dane konta przechowujemy do czasu usunięcia konta. Dane rozliczeniowe — przez okres wymagany przepisami (do 5 lat
            od końca roku podatkowego). Po zakończeniu okresu próbnego firma zachowuje dostęp do wersji podstawowej wraz
            z danymi. Administrator może w każdej chwili pobrać swoje dane (eksport) lub usunąć konto i wszystkie dane
            firmy w ustawieniach subskrypcji.
          </p>
        </Sekcja>

        <Sekcja n={7} t="Dane z konta Google (opcjonalna integracja)">
          <p>
            Jeśli użytkownik sam połączy konto Google (Gmail, Kalendarz, Zadania), aplikacja korzysta z uprawnień wyłącznie
            w zakresie wybranej funkcji i na wyraźne polecenie użytkownika. Wykorzystanie informacji z interfejsów API Google
            jest zgodne z{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              Zasadami dotyczącymi danych użytkownika usług API Google</a>, w tym z wymaganiami ograniczonego wykorzystania (Limited Use).
            Dane te nie są sprzedawane, nie służą reklamie ani trenowaniu modeli AI. Zgodę można cofnąć na{' '}
            <a href="https://myaccount.google.com/permissions" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>.
          </p>
        </Sekcja>

        <Sekcja n={8} t="Twoje prawa">
          <p>
            Masz prawo dostępu do danych, sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych, sprzeciwu
            wobec przetwarzania opartego na uzasadnionym interesie oraz cofnięcia zgody (bez wpływu na zgodność z prawem
            przetwarzania sprzed cofnięcia). Możesz też złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych.
            Wnioski: <a href={`mailto:${KONTAKT}`} className="text-blue-600 hover:underline">{KONTAKT}</a>.
          </p>
        </Sekcja>

        <Sekcja n={9} t="Pliki cookies">
          <p>
            Serwis używa wyłącznie niezbędnych plików cookies do utrzymania sesji po zalogowaniu. Nie stosujemy cookies
            reklamowych w aplikacji.
          </p>
        </Sekcja>

        <p className="mt-10 pt-6 border-t border-gray-100 text-sm text-gray-400">
          <a href="/regulamin" className="text-blue-600 hover:underline">Regulamin</a> · <a href="/login" className="text-blue-600 hover:underline">Logowanie</a>
        </p>
      </article>
    </main>
  )
}
