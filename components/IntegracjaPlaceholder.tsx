'use client'

// Integracje z systemami zewnętrznymi (POS, terminale płatnicze, bank) wymagają danych dostępowych dostawcy i konfiguracji po naszej stronie.
// Konto demo pokazuje przykładowy widok, a pozostałe firmy widzą ten ekran zamiast fikcyjnych transakcji.
export default function IntegracjaPlaceholder({ nazwa, opis }: { nazwa: string; opis: string }) {
  const temat = encodeURIComponent(`Integracja: ${nazwa}`)
  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900">{nazwa}</h1>
      <div className="mt-5 bg-white border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-3xl">🔌</p>
        <p className="font-medium text-gray-900 mt-2">Integracja nie jest jeszcze podłączona</p>
        <p className="text-sm text-gray-500 mt-1">{opis}</p>
        <a href={`mailto:skrojocrm@gmail.com?subject=${temat}`}
          style={{ background: '#2FB36D', color: '#FFFFFF', textDecoration: 'none' }}
          className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-medium">Zamów podłączenie</a>
      </div>
    </div>
  )
}
