import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function sanitize(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
    .replace(/^_|_$/, '').substring(0, 120) || `plik_${Date.now()}`
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const nazwa = formData.get('nazwa') as string || ''
    const kategoria = formData.get('kategoria') as string || 'inne'
    const opis = formData.get('opis') as string || ''

    if (!file) return NextResponse.json({ error: 'Brak pliku' }, { status: 400 })

    const safeName = sanitize(file.name)
    const path = `dokumenty/${Date.now()}_${safeName}`
    const bytes = await file.arrayBuffer()

    const { error: upErr } = await supabase.storage
      .from('firma').upload(path, bytes, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      })

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    const { data: { publicUrl } } = supabase.storage.from('firma').getPublicUrl(path)

    const { data, error } = await supabase.from('firma_dokumenty').insert({
      nazwa: nazwa || file.name,
      kategoria,
      opis,
      url: publicUrl,
      path,
      rozmiar: file.size,
      mime_type: file.type,
      aktywny: true,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, dokument: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
