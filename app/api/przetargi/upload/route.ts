import { NextRequest, NextResponse } from 'next/server'
import { wymagajModulu } from '@/lib/dostep-api'

export const maxDuration = 60

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/, '')
    .substring(0, 120) || `plik_${Date.now()}`
}

// Załączniki do przetargu: zapis w magazynie z sesją użytkownika; przetarg musi należeć do firmy użytkownika (RLS).
export async function POST(req: NextRequest) {
  try {
    const dostep = await wymagajModulu('Przetargi')
    if ('blad' in dostep) return dostep.blad
    const { supabase, firma } = dostep

    const formData = await req.formData()
    const przetargId = formData.get('przetargId') as string | null
    if (!przetargId) return NextResponse.json({ error: 'Brak ID przetargu' }, { status: 400 })
    const { data: p } = await supabase.from('przetargi').select('id').eq('id', przetargId).maybeSingle()
    if (!p) return NextResponse.json({ error: 'Nie znaleziono przetargu' }, { status: 404 })

    const files = formData.getAll('file') as File[]
    if (!files.length) return NextResponse.json({ error: 'Brak pliku' }, { status: 400 })

    const results: { name: string; url: string }[] = []
    const errors: string[] = []
    for (const file of files) {
      const path = `przetargi/${firma.id}/${przetargId}/${Date.now()}_${sanitize(file.name)}`
      const { error } = await supabase.storage.from('dokumenty').upload(path, await file.arrayBuffer(), {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      })
      if (error) { errors.push(`${file.name}: ${error.message}`); continue }
      results.push({ name: file.name, url: supabase.storage.from('dokumenty').getPublicUrl(path).data.publicUrl })
    }
    return NextResponse.json({ ok: true, files: results, errors })
  } catch (err: any) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 })
  }
}
