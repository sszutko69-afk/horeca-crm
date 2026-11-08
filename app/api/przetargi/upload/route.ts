import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

// Service role omija RLS i limity anon
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/, '')
    .substring(0, 120) || `plik_${Date.now()}`
}

export async function POST(req: NextRequest) {
  try {
    // Parsuj formData - Next.js App Router obsługuje to natywnie bez body parsera
    const formData = await req.formData()
    const przetargId = formData.get('przetargId') as string | null
    if (!przetargId) {
      return NextResponse.json({ error: 'Brak ID przetargu' }, { status: 400 })
    }

    const files = formData.getAll('file') as File[]
    if (!files.length) {
      return NextResponse.json({ error: 'Brak pliku' }, { status: 400 })
    }

    const results: { name: string; url: string }[] = []
    const errors: string[] = []

    for (const file of files) {
      const safeName = sanitize(file.name)
      const path = `przetargi/${przetargId}/${Date.now()}_${safeName}`

      // Konwertuj File → ArrayBuffer → Uint8Array
      const buffer = await file.arrayBuffer()

      const { error } = await supabase.storage
        .from('dokumenty')
        .upload(path, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: true,
        })

      if (error) {
        errors.push(`${file.name}: ${error.message}`)
        continue
      }

      const { data: { publicUrl } } = supabase.storage
        .from('dokumenty')
        .getPublicUrl(path)

      results.push({ name: file.name, url: publicUrl })
    }

    return NextResponse.json({ ok: true, files: results, errors })

  } catch (err: any) {
    console.error('[upload]', err)
    // Zawsze zwróć JSON - nigdy HTML
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 })
  }
}
