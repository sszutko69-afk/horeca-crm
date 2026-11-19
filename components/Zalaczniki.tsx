'use client'

import { useState } from 'react'

// Lista załączników (adresy plików w magazynie): otwarcie w nowej karcie i pobranie na dysk.
// Style inline: globalna reguła `a { color }` nadpisuje klasy Tailwind.
function nazwaPliku(url: string) {
  try {
    const n = decodeURIComponent(url.split('?')[0].split('/').pop() ?? 'plik')
    return n.replace(/^\d+_[a-z0-9]+\./i, 'plik.')
  } catch { return 'plik' }
}

export default function Zalaczniki({ urls }: { urls: string[] }) {
  const [blad, setBlad] = useState('')

  async function pobierz(url: string) {
    setBlad('')
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error(String(r.status))
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = nazwaPliku(url)
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    } catch {
      setBlad('Nie udało się pobrać pliku. Spróbuj „Otwórz” i zapisz z nowej karty.')
    }
  }

  const link: React.CSSProperties = { color: '#1D4ED8', textDecoration: 'none' }
  return (
    <div className="space-y-2">
      {urls.map((url, i) => {
        const obraz = /\.(jpg|jpeg|png|webp|gif)$/i.test(url.split('?')[0])
        return (
          <div key={i} className="flex items-center gap-3 border border-gray-200 rounded-lg p-2 bg-white">
            <a href={url} target="_blank" rel="noopener noreferrer" style={link} className="shrink-0">
              {obraz
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={url} alt="" className="w-12 h-12 object-cover rounded border border-gray-200" />
                : <span className="flex items-center justify-center w-12 h-12 rounded bg-gray-50 border border-gray-200 text-xl">📄</span>}
            </a>
            <span className="flex-1 min-w-0 text-xs text-gray-700 truncate">{nazwaPliku(url)}</span>
            <a href={url} target="_blank" rel="noopener noreferrer" style={link} className="text-xs font-medium px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">Otwórz</a>
            <button type="button" onClick={() => pobierz(url)} className="text-xs font-medium px-2 py-1 rounded border border-gray-200 hover:bg-gray-50" style={{ color: '#1D4ED8' }}>Pobierz</button>
          </div>
        )
      })}
      {blad && <p className="text-xs text-red-600">{blad}</p>}
    </div>
  )
}
