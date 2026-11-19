'use client'

import { useState } from 'react'

// Przycisk właściciela platformy: przedłuża okres próbny wskazanej firmy (pełna wersja na kolejne dni).
export default function PrzedluzProbe({ firmaId }: { firmaId: string }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  async function klik() {
    if (!confirm('Przedłużyć okres próbny tej firmy o 30 dni?')) return
    setBusy(true); setMsg('')
    const r = await fetch('/api/platforma/przedluz-probe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firmaId, dni: 30 }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    setMsg(r.ok ? 'Przedłużono do ' + new Date(j.trial_do).toLocaleDateString('pl-PL') : (j.error ?? 'Błąd'))
    if (r.ok) setTimeout(() => window.location.reload(), 900)
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={klik} disabled={busy} style={{ background: '#2FB36D', color: '#FFFFFF' }} className="text-xs px-2 py-1 rounded disabled:opacity-50">{busy ? '…' : '+30 dni próby'}</button>
      {msg && <span className="text-xs text-gray-600">{msg}</span>}
    </span>
  )
}
