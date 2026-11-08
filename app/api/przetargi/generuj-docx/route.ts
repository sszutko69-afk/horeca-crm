import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ONGAZ_LOGO_B64 } from '../../../../lib/ongaz-logo'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Pobierz dane firmy z bazy
async function getFirmaDane(): Promise<Record<string, string>> {
  const { data } = await supabase.from('firma_dane').select('klucz, wartosc')
  const dane: Record<string, string> = {}
  for (const row of data ?? []) {
    dane[row.klucz] = row.wartosc ?? ''
  }
  return dane
}

// Pobierz aktywne dokumenty firmy i ich treść
async function getFirmaDokumenty(): Promise<string> {
  const { data } = await supabase
    .from('firma_dokumenty')
    .select('nazwa, kategoria, opis, url, mime_type')
    .eq('aktywny', true)
    .order('kategoria')

  if (!data?.length) return ''

  const sekcje: string[] = []

  for (const doc of data) {
    const ext = doc.url.split('.').pop()?.toLowerCase() ?? ''
    let tresc = ''

    // Pobierz treść PDF i TXT server-side
    if (['pdf', 'txt', 'md'].includes(ext)) {
      try {
        const res = await fetch(doc.url, { signal: AbortSignal.timeout(10000) })
        if (res.ok) {
          if (ext === 'pdf') {
            const buf = await res.arrayBuffer()
            if (buf.byteLength < 5 * 1024 * 1024) { // max 5MB dla firmowych
              const base64 = Buffer.from(buf).toString('base64')
              // Dla PDF — dołącz jako base64 (obsługa przez Anthropic document blocks)
              sekcje.push(`[DOKUMENT PDF: ${doc.nazwa} | Kategoria: ${doc.kategoria} | ${doc.opis ?? ''} | base64:${base64.substring(0, 100)}...]`)
              continue
            }
          } else {
            tresc = (await res.text()).substring(0, 5000)
          }
        }
      } catch {}
    }

    if (tresc) {
      const header = '=== DOKUMENT FIRMY: ' + doc.nazwa + ' (' + doc.kategoria + ') ==='
      const opis = doc.opis ? 'Opis: ' + doc.opis + '\n' : ''
      sekcje.push(header + '\n' + opis + tresc + '\n')
    } else {
      sekcje.push(`[Dokument firmy: ${doc.nazwa} | Kategoria: ${doc.kategoria} | ${doc.opis ?? ''}]`)
    }
  }

  return sekcje.join('\n')

}

// Wywołaj AI do wygenerowania treści dokumentu
async function generateDocContent(
  typ: string,
  przetarg: any,
  firma: Record<string, string>,
  dokumentyTresc: string,
  firmaDokumenty: string
): Promise<string> {
  const dzisiaj = new Date().toLocaleDateString('pl-PL')

  const systemPrompt = [
    'Jesteś ekspertem od dokumentacji przetargowej w Polsce. Generujesz profesjonalne dokumenty przetargowe dla firmy ON Gaz. Odpowiadaj TYLKO treścią dokumentu, bez komentarzy ani wstępów.',
    '',
    'DANE FIRMY:',
    'Nazwa: ' + firma.nazwa,
    'NIP: ' + firma.nip,
    'REGON: ' + firma.regon,
    'KRS: ' + firma.krs,
    'Adres: ' + firma.adres,
    'Telefon: ' + firma.telefon,
    'Email: ' + firma.email,
    'Reprezentant: ' + firma.reprezentant + ', ' + firma.stanowisko,
    'Bank: ' + firma.bank,
    'Konto: ' + firma.konto,
    'Polisa OC: ' + firma.polisa_nr + ', suma: ' + firma.polisa_suma + ', ważna do: ' + firma.polisa_wazna,
    'Kierownik budowy: ' + firma.kierownik + ', uprawnienia: ' + firma.uprawnienia,
    'Doświadczenie: ' + firma.doswiadczenie,
    'Referencje: ' + firma.referencje,
    'Koncesje: ' + firma.koncesje,
    'Data: ' + dzisiaj,
    '',
    'PRZETARG:',
    'Tytuł: ' + przetarg.tytul,
    'Zamawiający: ' + przetarg.zamawiajacy,
    'Wartość: ' + (przetarg.wartosc_netto ? przetarg.wartosc_netto.toLocaleString('pl-PL') + ' PLN netto' : 'do wyceny'),
    'Termin składania: ' + przetarg.data_skladania,
    'CPV: ' + przetarg.cpv_kod,
    dokumentyTresc ? 'DOKUMENTACJA PRZETARGOWA:' + dokumentyTresc.substring(0, 8000) : '',
    firmaDokumenty ? 'DOKUMENTY FIRMOWE (referencje, polisy, koncesje):' + firmaDokumenty.substring(0, 5000) : '',
  ].filter(Boolean).join('\n')

  const prompts: Record<string, string> = {
    oferta: 'Wygeneruj FORMULARZ OFERTOWY dla tego przetargu. Struktura:\n1. Nagłówek z danymi firmy i zamawiającego\n2. Dane wykonawcy (tabela z pełnymi danymi firmy)\n3. Oświadczenie o złożeniu oferty\n4. Cena ofertowa (tabela z pozycjami kosztorysu jeśli znany zakres, lub miejsce na wpisanie)\n5. Termin realizacji\n6. Warunki płatności\n7. Oświadczenia wymagane przez SWZ\n8. Data i podpis\nFormat: używaj === dla tytułów sekcji, --- dla separatorów, tabel ASCII gdzie potrzeba.',

    oswiadczenie_warunkow: 'Wygeneruj OŚWIADCZENIE O SPEŁNIANIU WARUNKÓW UDZIAŁU W POSTĘPOWANIU (art. 125 ust. 1 PZP).\nUwzględnij: warunki dotyczące zdolności do prowadzenia działalności (koncesje), sytuacji ekonomicznej (ubezpieczenie OC), zdolności technicznej (doświadczenie, kierownik budowy).\nFormat profesjonalny, gotowy do podpisu.',

    oswiadczenie_wykluczenia: 'Wygeneruj OŚWIADCZENIE O BRAKU PODSTAW DO WYKLUCZENIA Z POSTĘPOWANIA (art. 125 ust. 1 PZP).\nUwzględnij wszystkie podstawy wykluczenia z art. 108 i 109 PZP.\nFormat profesjonalny, gotowy do podpisu.',

    wykaz_robot: 'Wygeneruj WYKAZ ROBÓT BUDOWLANYCH potwierdzający doświadczenie firmy.\nUżyj danych z referencji firmy. Tabela z kolumnami: lp, opis robót, wartość, data wykonania, podmiot zamawiający.\nDołącz oświadczenie o należytym wykonaniu.',

    wykaz_osob: 'Wygeneruj WYKAZ OSÓB skierowanych do realizacji zamówienia.\nUwzględnij kierownika budowy z danymi o uprawnieniach.\nTabela z kolumnami: imię i nazwisko, funkcja, kwalifikacje/uprawnienia, doświadczenie, podstawa dysponowania.',

    zobowiazanie: 'Wygeneruj ZOBOWIĄZANIE PODMIOTU UDOSTĘPNIAJĄCEGO ZASOBY (jeśli dotyczy).\nStandardowe zobowiązanie zgodne z art. 118 PZP.',

    pelnomocnictwo: 'Wygeneruj PEŁNOMOCNICTWO do reprezentowania wykonawcy w postępowaniu.\nDane mocodawcy: ${firma.nazwa}, reprezentowana przez ${firma.reprezentant} (${firma.stanowisko}).\nMiejsce na dane pełnomocnika do uzupełnienia.',

    kosztorys: 'Wygeneruj KOSZTORYS OFERTOWY (uproszczony) dla tego przetargu.\nNa podstawie zakresu robót oszacuj pozycje kosztorysowe (KNR/KNNR).\nTabela: lp, opis, j.m., ilość, cena jedn. netto, wartość netto.\nSuma netto, VAT 23%, suma brutto.\nJeśli zakres nieznany — wstaw typowe pozycje dla tego rodzaju robót z cenami rynkowymi.',
  }

  const userPrompt = prompts[typ] || `Wygeneruj dokument typu: ${typ} dla tego przetargu.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

// Konwertuj tekst AI na DOCX przez docx-js (server-side Node.js)
async function textToDocx(content: string, tytul: string, firma: Record<string, string>, uwagi?: string): Promise<Buffer> {
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
    AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  } = await import('docx')

  const dzisiaj = new Date().toLocaleDateString('pl-PL')
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
  const borders = { top: border, bottom: border, left: border, right: border }

  // Logo ON Gaz — base64 PNG → Buffer
  const logoBase64 = ONGAZ_LOGO_B64.split(',')[1] ?? ''
  const logoBuffer = Buffer.from(logoBase64, 'base64')

  // Parsuj tekst na paragrafy
  const lines = content.split('\n')
  const children: any[] = []

  // Nagłówek dokumentu — logo (lewy), potem dane firmy wyśrodkowane
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [
        new ImageRun({
          data: logoBuffer,
          transformation: { width: 90, height: 90 },
          type: 'png',
        } as never),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: firma.nazwa, bold: true, size: 32, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: `NIP: ${firma.nip} | REGON: ${firma.regon}`, size: 22, color: '666666', font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: firma.adres, size: 22, color: '666666', font: 'Arial' })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 300 },
      children: [new TextRun({ text: tytul.toUpperCase(), bold: true, size: 36, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [new TextRun({ text: `Data: ${dzisiaj}`, size: 24, font: 'Arial' })],
    })
  )

  // Parsuj treść
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 100 } }))
      continue
    }

    // Tytuły sekcji (===)
    if (trimmed.startsWith('===') || trimmed.endsWith('===')) {
      const text = trimmed.replace(/^=+|=+$/g, '').trim()
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
        children: [new TextRun({ text, bold: true, size: 28, font: 'Arial', color: '1F4E79' })],
      }))
      continue
    }

    // Separatory (--)
    if (/^-{3,}$/.test(trimmed)) {
      children.push(new Paragraph({
        spacing: { before: 140, after: 140 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } },
        children: [],
      }))
      continue
    }

    // Tabela ASCII — uproszczona obsługa
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').filter(c => c.trim() && !/^[-\s]+$/.test(c))
      if (cells.length > 0) {
        children.push(new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: cells.map(() => Math.floor(9026 / cells.length)),
          rows: [new TableRow({
            children: cells.map(cell => new TableCell({
              borders,
              width: { size: Math.floor(9026 / cells.length), type: WidthType.DXA },
              shading: { fill: 'F0F4F8', type: ShadingType.CLEAR },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [new Paragraph({
                children: [new TextRun({ text: cell.trim(), size: 22, font: 'Arial' })],
              })],
            })),
          })],
        }))
        continue
      }
    }

    // Bold (** **)
    const boldMatch = trimmed.match(/^\*\*(.+)\*\*$/)
    if (boldMatch) {
      children.push(new Paragraph({
        spacing: { before: 140, after: 100 },
        children: [new TextRun({ text: boldMatch[1], bold: true, size: 24, font: 'Arial' })],
      }))
      continue
    }

    // Lista (- lub •)
    if (/^[-•]\s/.test(trimmed)) {
      children.push(new Paragraph({
        indent: { left: 720 },
        spacing: { after: 80 },
        children: [new TextRun({ text: '• ' + trimmed.replace(/^[-•]\s/, ''), size: 24, font: 'Arial' })],
      }))
      continue
    }

    // Zwykły tekst
    children.push(new Paragraph({
      spacing: { after: 140 },
      children: [new TextRun({ text: trimmed, size: 24, font: 'Arial' })],
    }))
  }

  // Uwagi (jeśli przekazane)
  if (uwagi) {
    children.push(
      new Paragraph({
        spacing: { before: 400, after: 160 },
        children: [new TextRun({ text: 'UWAGI:', bold: true, size: 26, font: 'Arial', color: '1F4E79' })],
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: uwagi, size: 24, font: 'Arial' })],
      })
    )
  }

  // Stopka — podpis
  children.push(
    new Paragraph({ spacing: { before: 720 } }),
    new Paragraph({
      spacing: { before: 480, after: 60 },
      children: [new TextRun({ text: `${firma.miejscowosc || firma.adres.split(',').pop()?.trim() || 'Miejscowość'}, dnia ${dzisiaj}`, size: 24, font: 'Arial' })],
    }),
    new Paragraph({
      spacing: { before: 720, after: 60 },
      children: [new TextRun({ text: '...................................', size: 24, font: 'Arial' })],
    }),
    new Paragraph({
      children: [new TextRun({ text: firma.reprezentant, bold: true, size: 24, font: 'Arial' })],
    }),
    new Paragraph({
      children: [new TextRun({ text: firma.stanowisko, size: 22, color: '666666', font: 'Arial' })],
    }),
    new Paragraph({
      children: [new TextRun({ text: firma.nazwa, size: 22, color: '666666', font: 'Arial' })],
    })
  )

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 24 } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 },
        },
      },
      children,
    }],
  })

  return await Packer.toBuffer(doc)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const firma = await getFirmaDane()

    // ── Tryb: oferta z kosztorysu ────────────────────────────────────────────
    if (body.tryb === 'oferta_kosztorys') {
      const { kosztorys } = body
      if (!kosztorys) return NextResponse.json({ error: 'Brak danych kosztorysu' }, { status: 400 })

      const pozTxt = (kosztorys.pozycje ?? []).map((p: any, i: number) =>
        `${p.lp ?? i+1}. ${p.opis} [${p.jm ?? 'szt.'} × ${p.ilosc}] = ${Number(p.razem).toLocaleString('pl-PL')} PLN netto`
      ).join('\n')

      const systemPrompt = [
        'Jesteś ekspertem od dokumentów ofertowych. Generujesz profesjonalne pismo ofertowe dla firmy budowlano-instalacyjnej.',
        'DANE FIRMY:', `Nazwa: ${firma.nazwa}`, `NIP: ${firma.nip}`, `Adres: ${firma.adres}`,
        `Telefon: ${firma.telefon}`, `Email: ${firma.email}`,
        `Reprezentant: ${firma.reprezentant ?? ''}, ${firma.stanowisko ?? ''}`,
        `Konto bankowe: ${firma.bank ?? ''} ${firma.konto ?? ''}`,
        'Odpowiadaj TYLKO treścią dokumentu, bez komentarzy. Używaj === dla tytułów sekcji, --- dla separatorów.',
      ].join('\n')

      const userPrompt = `Wygeneruj PISMO OFERTOWE na podstawie poniższego kosztorysu.

KOSZTORYS: ${kosztorys.numer}
Nazwa zadania: ${kosztorys.nazwa}
Inwestor: ${kosztorys.inwestor || 'do uzupełnienia'}
Obiekt: ${kosztorys.obiekt || 'do uzupełnienia'}
Data sporządzenia: ${kosztorys.data}
${kosztorys.uwagi ? `Uwagi: ${kosztorys.uwagi}` : ''}

POZYCJE KOSZTORYSOWE:
${pozTxt}

WARTOŚCI:
Razem netto: ${Number(kosztorys.razem_netto).toLocaleString('pl-PL')} PLN
VAT 23%: ${Number(kosztorys.razem_vat).toLocaleString('pl-PL')} PLN
RAZEM BRUTTO: ${Number(kosztorys.razem_brutto).toLocaleString('pl-PL')} PLN

Struktura pisma:
1. Nagłówek (dane firmy i inwestora)
2. Temat: Oferta na realizację robót / dostaw
3. Szanowni Państwo — krótki wstęp
4. Zakres prac (lista głównych pozycji z kosztorysu)
5. Cena ofertowa (tabela z kwotami netto/VAT/brutto)
6. Termin realizacji (miejsce do uzupełnienia)
7. Warunki płatności
8. Ważność oferty (30 dni)
9. Podpis i pieczęć`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 3000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })
      const aiData = await res.json()
      const content = aiData.content?.[0]?.text ?? ''
      const buffer = await textToDocx(content, `Oferta – ${kosztorys.nazwa}`, firma, kosztorys.uwagi || undefined)
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="Oferta_${kosztorys.numer.replace(/[/\\]/g,'-')}.docx"`,
        },
      })
    }

    // ── Tryb standardowy: dokumenty przetargowe ──────────────────────────────
    const { typ, przetarg, dokumentyTresc } = body
    if (!typ || !przetarg) return NextResponse.json({ error: 'Brak parametrów' }, { status: 400 })

    const firmaDokStr = await getFirmaDokumenty()
    const content = await generateDocContent(typ, przetarg, firma, dokumentyTresc ?? '', firmaDokStr)
    const buffer = await textToDocx(content, TYPY_DOC[typ]?.label ?? typ, firma)

    const safeName = `${typ}_${przetarg.tytul.substring(0, 40).replace(/[^a-zA-Z0-9]/g, '_')}.docx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeName}"`,
      },
    })
  } catch (err: any) {
    console.error('[generuj-docx]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

const TYPY_DOC: Record<string, { label: string }> = {
  oferta:                  { label: 'Formularz ofertowy' },
  oswiadczenie_warunkow:   { label: 'Oświadczenie o spełnianiu warunków' },
  oswiadczenie_wykluczenia:{ label: 'Oświadczenie o braku podstaw wykluczenia' },
  wykaz_robot:             { label: 'Wykaz robót budowlanych' },
  wykaz_osob:              { label: 'Wykaz osób' },
  zobowiazanie:            { label: 'Zobowiązanie podmiotu udostępniającego zasoby' },
  pelnomocnictwo:          { label: 'Pełnomocnictwo' },
  kosztorys:               { label: 'Kosztorys ofertowy' },
}
