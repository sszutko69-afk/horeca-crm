import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

// Pobiera treść pliku z URL i zwraca jako tekst lub base64 PDF
// Działa server-side - omija CORS przeglądarki
export async function POST(req: NextRequest) {
  try {
    const { url, name } = await req.json()
    if (!url) return NextResponse.json({ error: 'Brak URL' }, { status: 400 })

    const ext = (name || url).split('.').pop()?.toLowerCase() ?? ''

    const res = await fetch(url, { 
      signal: AbortSignal.timeout(20000) // 20s timeout
    })
    if (!res.ok) return NextResponse.json({ type: 'skip', error: `HTTP ${res.status}` })

    // PDF — zwróć jako base64 (max 8MB dla Anthropic)
    if (ext === 'pdf') {
      const buf = await res.arrayBuffer()
      const MAX_PDF = 8 * 1024 * 1024 // 8MB
      if (buf.byteLength > MAX_PDF) {
        return NextResponse.json({ 
          type: 'text', 
          content: `[Plik PDF: ${name} — ${Math.round(buf.byteLength/1024/1024)}MB — za duży do analizy AI (max 8MB). Pobierz i sprawdź ręcznie.]` 
        })
      }
      const base64 = Buffer.from(buf).toString('base64')
      return NextResponse.json({ type: 'pdf', content: base64, size: buf.byteLength })
    }

    // DOCX — wyciągnij tekst przez prosty parser XML
    if (['docx', 'doc'].includes(ext)) {
      const buf = await res.arrayBuffer()
      // Próba wyciągnięcia tekstu z DOCX (ZIP z word/document.xml)
      try {
        const bytes = new Uint8Array(buf)
        const str = Buffer.from(bytes).toString('latin1')
        // Znajdź fragment XML z tekstem
        const xmlStart = str.indexOf('<w:body')
        const xmlEnd = str.indexOf('</w:body>')
        if (xmlStart >= 0 && xmlEnd >= 0) {
          const xml = str.substring(xmlStart, xmlEnd + 9)
          const text = xml
            .replace(/<w:br[^>]*\/>/g, '\n')
            .replace(/<w:p[ >][^>]*>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
          if (text.length > 50) {
            return NextResponse.json({ type: 'text', content: text.substring(0, 15000) })
          }
        }
      } catch {}
      return NextResponse.json({ 
        type: 'text', 
        content: `[Plik DOCX: ${name} — ${Math.round(buf.byteLength/1024)}KB. Plik Word — AI widzi jego nazwę ale nie treść. Dla pełnej analizy przekonwertuj do PDF.]` 
      })
    }

    // XLSX
    if (['xlsx', 'xls'].includes(ext)) {
      const buf = await res.arrayBuffer()
      return NextResponse.json({ 
        type: 'text', 
        content: `[Plik Excel: ${name} — ${Math.round(buf.byteLength/1024)}KB. Treść niedostępna w podglądzie AI.]` 
      })
    }

    // TXT/HTML/MD/CSV
    if (['txt', 'md', 'csv', 'html', 'htm'].includes(ext)) {
      const text = await res.text()
      const clean = ext === 'html' || ext === 'htm'
        ? text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : text
      return NextResponse.json({ type: 'text', content: clean.substring(0, 15000) })
    }

    return NextResponse.json({ type: 'skip' })
  } catch (err: any) {
    return NextResponse.json({ type: 'skip', error: err.message }, { status: 200 })
  }
}
