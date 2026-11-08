'use client'

import { useState } from 'react'

export default function BackupPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  async function runBackup() {
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/backup')
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setResult(data)
      } else {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `gazcrm-backup-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setResult({ ok: true, plik: a.download })
      }
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Archiwizacja danych</h1>
          <p className="text-sm text-gray-500 mt-0.5">Backup bazy danych GazCRM do pliku JSON</p>
        </div>
        <button onClick={runBackup} disabled={loading}
          className="text-sm bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700 transition-colors disabled:opacity-50">
          {loading ? 'Archiwizacja...' : '↓ Pobierz backup'}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Co jest archiwizowane</h2>
        <div className="grid grid-cols-2 gap-2">
          {['Klienci','Zakupy gazu (EDD)','Sprzedaż','Inwestycje i etapy','Trasy cysterny','Profile użytkowników'].map(t => (
            <div key={t} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-green-500 text-xs">✓</span>{t}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Harmonogram automatyczny</h2>
        <div className="flex items-center gap-3 mb-2">
          <span className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded font-medium">Vercel Cron</span>
          <span className="text-sm text-gray-700">Niedziela · 23:59 · co tydzień</span>
        </div>
        <p className="text-xs text-gray-500">Automatyczny backup przez Vercel Cron zapisuje plik JSON co niedzielę.</p>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-4">{error}</p>}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <p className="text-sm font-medium text-green-800 mb-2">Backup pobrany!</p>
          <p className="text-xs text-green-700">Plik: <span className="font-mono">{result.plik}</span></p>
          {result.timestamp && <p className="text-xs text-green-700 mt-1">Czas: {new Date(result.timestamp).toLocaleString('pl-PL')}</p>}
          {result.statystyki && (
            <div className="mt-2 pt-2 border-t border-green-200 text-xs text-green-700 space-y-0.5">
              {Object.entries(result.statystyki).map(([k, v]) => <div key={k}>{k}: {String(v)}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
