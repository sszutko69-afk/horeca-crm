import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Polityka prywatności — GazCRM',
  description: 'Jak aplikacja GazCRM przetwarza dane, w tym dane z konta Google.',
}

const AKTUALIZACJA = '18 października 2026'

export default function PolitykaPrywatnosci() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <article className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 md:p-12">
        <h1 className="text-2xl font-semibold text-gray-900">Polityka prywatności aplikacji GazCRM</h1>
        <p className="text-sm text-gray-500 mt-2">Ostatnia aktualizacja: {AKTUALIZACJA}</p>

        <section className="mt-8 space-y-3 text-gray-700 text-[15px] leading-relaxed">
          <h2 className="text-lg font-medium text-gray-900">1. Administrator danych</h2>
          <p>
            Administratorem danych przetwarzanych w aplikacji GazCRM jest <strong>ON GAZ Sp. z o.o.</strong> z siedzibą
            w Warszawie, NIP 5213917162. Kontakt w sprawach dotyczących danych:{' '}
            <a href="mailto:sszutko69@gmail.com" className="text-blue-600 hover:underline">sszutko69@gmail.com</a>.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-gray-700 text-[15px] leading-relaxed">
          <h2 className="text-lg font-medium text-gray-900">2. Czym jest GazCRM</h2>
          <p>
            GazCRM to wewnętrzny system zarządzania firmą gazową: ewidencja klientów, zakupów i sprzedaży LPG,
            rozliczenia dokumentów akcyzowych, obsługa inwestycji budowlanych oraz monitoring ogłoszeń
            przetargowych. Z aplikacji korzystają wyłącznie upoważnieni pracownicy ON GAZ Sp. z o.o.
            Aplikacja nie jest udostępniana publicznie ani oferowana osobom trzecim.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-gray-700 text-[15px] leading-relaxed">
          <h2 className="text-lg font-medium text-gray-900">3. Dane z konta Google</h2>
          <p>
            Po wyrażeniu zgody przez użytkownika aplikacja łączy się z jego kontem Google i korzysta
            z następujących uprawnień wyłącznie w zakresie opisanym poniżej:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Gmail</strong> — odczyt wiadomości oznaczonych etykietą „Przetargi" w celu rozpoznania
              w nich ogłoszeń przetargowych i zapisania ich w bazie aplikacji. Zapisywane są wyłącznie dane
              dotyczące postępowania: tytuł, numer, zamawiający, termin składania, wartość i odnośnik do
              ogłoszenia, wraz z fragmentem treści wiadomości jako uzasadnienie wpisu. Aplikacja umożliwia
              również wysyłanie wiadomości na wyraźne polecenie użytkownika.
            </li>
            <li>
              <strong>Kalendarz Google</strong> — odczyt i zapis wydarzeń powiązanych z terminami przetargów
              i realizacją zleceń.
            </li>
            <li>
              <strong>Zadania Google</strong> — odczyt i zapis zadań synchronizowanych z modułem zadań aplikacji.
            </li>
          </ul>
          <p>
            Aplikacja nie odczytuje wiadomości spoza wskazanej etykiety, nie pobiera załączników w celu innym
            niż dołączenie ich do konkretnego postępowania i nie modyfikuje treści wiadomości użytkownika.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-gray-700 text-[15px] leading-relaxed">
          <h2 className="text-lg font-medium text-gray-900">4. Ograniczone wykorzystanie danych Google</h2>
          <p>
            Wykorzystanie przez GazCRM informacji otrzymanych z interfejsów API Google odbywa się zgodnie
            z <a href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              Zasadami dotyczącymi danych użytkownika usług API Google</a>, w tym z wymaganiami
            ograniczonego wykorzystania (Limited Use).
          </p>
          <p className="text-sm text-gray-500 italic border-l-2 border-gray-200 pl-4">
            GazCRM&apos;s use of information received from Google APIs will adhere to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              Google API Services User Data Policy</a>, including the Limited Use requirements.
          </p>
          <p>W szczególności dane uzyskane z konta Google:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>nie są sprzedawane ani przekazywane podmiotom trzecim,</li>
            <li>nie są wykorzystywane do wyświetlania reklam ani profilowania reklamowego,</li>
            <li>nie są wykorzystywane do trenowania modeli sztucznej inteligencji,</li>
            <li>nie są odczytywane przez ludzi, poza przypadkami wyraźnej zgody użytkownika, potrzeb
              bezpieczeństwa, wymogów prawa lub zagregowanej i zanonimizowanej analizy działania aplikacji.</li>
          </ul>
        </section>

        <section className="mt-8 space-y-3 text-gray-700 text-[15px] leading-relaxed">
          <h2 className="text-lg font-medium text-gray-900">5. Przechowywanie i bezpieczeństwo</h2>
          <p>
            Dane aplikacji przechowywane są w bazie Supabase (PostgreSQL) z dostępem ograniczonym przez
            mechanizm Row Level Security. Połączenia szyfrowane są protokołem TLS. Tokeny dostępu do konta
            Google przechowywane są wyłącznie na serwerze i nie są udostępniane w przeglądarce ani stronom
            trzecim. Dane dotyczące postępowań przetargowych przechowywane są przez okres przydatności
            biznesowej; dane księgowe i rozliczeniowe — przez okres wymagany przepisami prawa.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-gray-700 text-[15px] leading-relaxed">
          <h2 className="text-lg font-medium text-gray-900">6. Cofnięcie zgody</h2>
          <p>
            Zgodę na dostęp aplikacji do konta Google można wycofać w dowolnym momencie na stronie{' '}
            <a href="https://myaccount.google.com/permissions" className="text-blue-600 hover:underline"
              target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>.
            Po cofnięciu zgody aplikacja traci dostęp do danych konta Google. Usunięcie danych już zapisanych
            w bazie aplikacji następuje na żądanie przesłane na adres kontaktowy podany w punkcie 1.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-gray-700 text-[15px] leading-relaxed">
          <h2 className="text-lg font-medium text-gray-900">7. Prawa użytkownika</h2>
          <p>
            Zgodnie z RODO użytkownikom przysługuje prawo dostępu do swoich danych, ich sprostowania,
            usunięcia, ograniczenia przetwarzania, przenoszenia oraz wniesienia sprzeciwu, a także prawo
            wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych. Realizację tych praw obsługuje
            adres kontaktowy wskazany w punkcie 1.
          </p>
        </section>

        <section className="mt-8 space-y-3 text-gray-700 text-[15px] leading-relaxed">
          <h2 className="text-lg font-medium text-gray-900">8. Zmiany polityki</h2>
          <p>
            O istotnych zmianach sposobu wykorzystania danych pochodzących z konta Google użytkownicy
            informowani są poprzez aktualizację tej strony wraz z datą ostatniej zmiany podaną na górze
            dokumentu.
          </p>
        </section>

        <p className="mt-10 pt-6 border-t border-gray-100 text-sm text-gray-400">
          <a href="/o-aplikacji" className="text-blue-600 hover:underline">← GazCRM</a>
        </p>
      </article>
    </main>
  )
}
