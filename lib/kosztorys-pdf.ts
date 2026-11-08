import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ONGAZ_LOGO_B64 } from './ongaz-logo'

const fmt = (v: number) =>
  new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

type Pozycja = {
  lp: number; typ: string; knr_kod: string | null; opis: string
  jm: string | null; ilosc: number
  r_j: number; m_j: number; s_j: number
  r_wartosc: number; m_wartosc: number; s_wartosc: number
  bezposrednie: number; kp_wartosc: number; kzm_wartosc: number
  z_wartosc: number; razem: number
}

type Kosztorys = {
  numer: string; nazwa: string; inwestor: string | null; obiekt: string | null
  lokalizacja: string | null; data_sporzadzenia: string; status: string; uwagi: string | null
  kp_procent: number; kzm_procent: number; z_procent: number; vat_procent: number
  razem_r: number; razem_m: number; razem_s: number
  razem_bezposrednie: number; razem_kp: number; razem_kzm: number
  razem_z: number; razem_netto: number; razem_vat: number; razem_brutto: number
}

// Ładowanie czcionki TTF z /public/fonts/ (statyczne pliki, brak proxy, brak CORS)
async function loadFont(name: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 20000)
    const res = await fetch(`/fonts/${name}.ttf`, {
      signal: controller.signal,
      cache: 'force-cache',
    })
    clearTimeout(tid)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let s = ''
    for (let i = 0; i < bytes.length; i += 8192) {
      s += String.fromCharCode(...bytes.subarray(i, i + 8192))
    }
    return btoa(s)
  } catch {
    return null
  }
}

// Przytnij tekst tak, żeby zmieścił się w maxMm mm przy aktualnym foncie/rozmiarze
function truncateFit(doc: jsPDF, text: string, maxMm: number): string {
  if (!text) return ''
  if (doc.getTextWidth(text) <= maxMm) return text
  let lo = 0, hi = text.length
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (doc.getTextWidth(text.slice(0, mid) + '…') <= maxMm) lo = mid
    else hi = mid
  }
  return text.slice(0, lo) + '…'
}

export async function generateKosztorysPDF(kos: Kosztorys, pozycje: Pozycja[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()   // 297
  const marginL = 12, marginR = 12
  const usableW = W - marginL - marginR        // 273 mm

  // ── Ładuj czcionkę Roboto (obsługa polskich znaków) ──────────────────────────
  let fontFamily = 'helvetica'
  try {
    const [b64R, b64B, b64I] = await Promise.all([
      loadFont('roboto-regular'),
      loadFont('roboto-bold'),
      loadFont('roboto-italic'),
    ])
    if (b64R && b64B) {
      doc.addFileToVFS('Roboto-Regular.ttf', b64R)
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
      doc.addFileToVFS('Roboto-Bold.ttf', b64B)
      doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
      if (b64I) {
        doc.addFileToVFS('Roboto-Italic.ttf', b64I)
        doc.addFont('Roboto-Italic.ttf', 'Roboto', 'italic')
      }
      fontFamily = 'Roboto'
    }
  } catch {
    // fallback do helvetica bez polskich znaków
  }

  const setN = () => doc.setFont(fontFamily, 'normal')
  const setB = () => doc.setFont(fontFamily, 'bold')
  const setI = () => doc.setFont(fontFamily, 'italic')

  // ── Kolory ON Gaz ─────────────────────────────────────────────────────────
  const GREEN: [number, number, number] = [67, 160, 71]
  const DARK: [number, number, number] = [55, 55, 55]
  const LIGHT_GRAY: [number, number, number] = [245, 245, 245]
  const MID_GRAY: [number, number, number] = [200, 200, 200]

  // ── NAGŁÓWEK z logo ───────────────────────────────────────────────────────
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, W, 22, 'F')

  doc.addImage(ONGAZ_LOGO_B64, 'PNG', marginL, 2, 44, 18)

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  setB()
  doc.text('KOSZTORYS INWESTORSKI', W / 2, 14, { align: 'center' })

  doc.setFontSize(9)
  setN()
  doc.text(`Nr: ${kos.numer}`, W - marginR, 8, { align: 'right' })
  doc.text(`Data: ${kos.data_sporzadzenia}`, W - marginR, 15, { align: 'right' })

  // ── DANE KOSZTORYSU ───────────────────────────────────────────────────────
  let y = 27
  doc.setTextColor(...DARK)
  doc.setFillColor(...LIGHT_GRAY)
  doc.rect(marginL, y, usableW, 26, 'F')
  doc.setDrawColor(...MID_GRAY)
  doc.rect(marginL, y, usableW, 26, 'S')

  doc.setFontSize(13)
  setB()
  doc.setTextColor(...GREEN)
  doc.text(truncateFit(doc, kos.nazwa, usableW - 60), marginL + 3, y + 7)

  doc.setFontSize(9)
  setN()
  doc.setTextColor(...DARK)

  const col1 = marginL + 3
  const col2 = W / 2
  const col3 = W * 0.72

  // Każde pole — ograniczone szerokością
  if (kos.inwestor) {
    setB(); doc.text('Inwestor:', col1, y + 14)
    setN()
    const inwMaxMm = col2 - (col1 + 24) - 4
    doc.text(truncateFit(doc, kos.inwestor, inwMaxMm), col1 + 24, y + 14)
  }
  if (kos.obiekt) {
    setB(); doc.text('Obiekt:', col2, y + 14)
    setN()
    const obiMaxMm = col3 - (col2 + 19) - 4
    doc.text(truncateFit(doc, kos.obiekt, obiMaxMm), col2 + 19, y + 14)
  }
  if (kos.lokalizacja) {
    setB(); doc.text('Lokalizacja:', col3, y + 14)
    setN()
    const lokX = col3 + 28
    const lokMaxMm = W - marginR - lokX
    doc.text(truncateFit(doc, kos.lokalizacja, lokMaxMm), lokX, y + 14)
  }

  // Narzuty
  setB()
  doc.text(`Narzuty:`, col1, y + 22)
  setN()
  doc.text(
    `Kp=${kos.kp_procent}%  Kzm=${kos.kzm_procent}%  Z=${kos.z_procent}%  VAT=${kos.vat_procent}%`,
    col1 + 20, y + 22
  )

  // ── TABELA POZYCJI ────────────────────────────────────────────────────────
  y = 57

  const tableRows: (string | { content: string; styles?: Record<string, unknown> })[][] = []

  for (const p of pozycje) {
    if (p.typ === 'dzial') {
      tableRows.push([{
        content: p.opis.toUpperCase(),
        colSpan: 13,
        styles: {
          fillColor: [55, 55, 55] as [number, number, number],
          textColor: [255, 255, 255] as [number, number, number],
          fontStyle: 'bold',
          fontSize: 9,
        }
      } as never])
    } else if (p.typ === 'nota') {
      tableRows.push([{
        content: `   ↳ ${p.opis}`,
        colSpan: 13,
        styles: {
          fillColor: [255, 253, 231] as [number, number, number],
          textColor: [120, 100, 0] as [number, number, number],
          fontStyle: 'italic',
          fontSize: 8,
        }
      } as never])
    } else {
      tableRows.push([
        String(p.lp),
        p.knr_kod || '',
        p.opis,
        p.jm || '',
        fmt(p.ilosc),
        p.r_j > 0 ? fmt(p.r_j) : '',
        p.m_j > 0 ? fmt(p.m_j) : '',
        p.s_j > 0 ? fmt(p.s_j) : '',
        p.r_wartosc > 0 ? fmt(p.r_wartosc) : '',
        p.m_wartosc > 0 ? fmt(p.m_wartosc) : '',
        p.s_wartosc > 0 ? fmt(p.s_wartosc) : '',
        fmt(p.bezposrednie),
        { content: fmt(p.razem), styles: { fontStyle: 'bold' } } as never,
      ])
    }
  }

  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR },
    head: [[
      'Lp', 'KNR', 'Opis roboty / materialu', 'JM', 'Ilosc',
      'R/jm', 'M/jm', 'S/jm',
      'R wartosc', 'M wartosc', 'S wartosc',
      'Bezposrednie', 'Razem'
    ]],
    body: tableRows,
    headStyles: {
      fillColor: GREEN,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      font: fontFamily,
    },
    columnStyles: {
      0:  { cellWidth: 9,  halign: 'center', fontSize: 8 },
      1:  { cellWidth: 20, fontSize: 7.5, textColor: [100, 100, 100] },
      2:  { cellWidth: 'auto', fontSize: 8.5 },
      3:  { cellWidth: 11, halign: 'center', fontSize: 8 },
      4:  { cellWidth: 15, halign: 'right', fontSize: 8 },
      5:  { cellWidth: 15, halign: 'right', fontSize: 8, textColor: [230, 81, 0] },
      6:  { cellWidth: 15, halign: 'right', fontSize: 8, textColor: [13, 71, 161] },
      7:  { cellWidth: 15, halign: 'right', fontSize: 8, textColor: [74, 20, 140] },
      8:  { cellWidth: 19, halign: 'right', fontSize: 8, textColor: [230, 81, 0] },
      9:  { cellWidth: 19, halign: 'right', fontSize: 8, textColor: [13, 71, 161] },
      10: { cellWidth: 19, halign: 'right', fontSize: 8, textColor: [74, 20, 140] },
      11: { cellWidth: 19, halign: 'right', fontSize: 8 },
      12: { cellWidth: 24, halign: 'right', fontSize: 8.5, fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    styles: { overflow: 'linebreak', cellPadding: 2, font: fontFamily },
    didParseCell: (data) => {
      if (data.row.section === 'head') return
    },
  })

  // ── PODSUMOWANIE ──────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight()  // 210 (landscape)
  const rawFinalY = (doc as never as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  const sumH = 74  // wysokość bloku podsumowania

  // Dodaj nową stronę jeśli podsumowanie nie zmieści się
  let sy = rawFinalY + 6
  if (sy + sumH > pageH - 12) {
    doc.addPage()
    sy = 12
  }

  const sumW = 140
  const sumX = W - marginR - sumW

  doc.setFillColor(...LIGHT_GRAY)
  doc.rect(sumX, sy, sumW, sumH, 'F')
  doc.setDrawColor(...MID_GRAY)
  doc.rect(sumX, sy, sumW, sumH, 'S')

  doc.setFontSize(10)
  setB()
  doc.setTextColor(...GREEN)
  doc.text('PODSUMOWANIE KOSZTORYSU', sumX + 4, sy + 7)

  doc.setFontSize(9)
  doc.setTextColor(...DARK)

  const rows = [
    ['R - Robocizna:', fmt(kos.razem_r) + ' zl'],
    ['M - Materialy:', fmt(kos.razem_m) + ' zl'],
    ['S - Sprzet:', fmt(kos.razem_s) + ' zl'],
    ['Koszty bezposrednie (R+M+S):', fmt(kos.razem_bezposrednie) + ' zl'],
    [`Kp (${kos.kp_procent}% od R+S):`, fmt(kos.razem_kp) + ' zl'],
    [`Kzm (${kos.kzm_procent}% od M):`, fmt(kos.razem_kzm) + ' zl'],
    [`Z (${kos.z_procent}% od R+S+Kp):`, fmt(kos.razem_z) + ' zl'],
  ]

  let ry = sy + 14
  for (const [label, val] of rows) {
    setN()
    doc.text(label, sumX + 4, ry)
    setB()
    doc.text(val, sumX + sumW - 4, ry, { align: 'right' })
    ry += 6
  }

  doc.setDrawColor(...MID_GRAY)
  doc.line(sumX + 4, ry, sumX + sumW - 4, ry)
  ry += 5

  setN()
  doc.text('Wartosc kosztorysowa netto:', sumX + 4, ry)
  setB()
  doc.text(fmt(kos.razem_netto) + ' zl', sumX + sumW - 4, ry, { align: 'right' })
  ry += 6

  setN()
  doc.text(`VAT ${kos.vat_procent}%:`, sumX + 4, ry)
  setB()
  doc.text(fmt(kos.razem_vat) + ' zl', sumX + sumW - 4, ry, { align: 'right' })
  ry += 2

  // BRUTTO — wyróżniony
  doc.setFillColor(...GREEN)
  doc.rect(sumX + 2, ry, sumW - 4, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  setB()
  doc.text('RAZEM BRUTTO:', sumX + 5, ry + 6.5)
  doc.text(fmt(kos.razem_brutto) + ' zl', sumX + sumW - 5, ry + 6.5, { align: 'right' })

  // Uwagi
  if (kos.uwagi) {
    doc.setTextColor(...DARK)
    doc.setFontSize(8)
    setI()
    doc.text(`Uwagi: ${kos.uwagi}`, marginL, sy + 5)
  }

  // ── STOPKA na każdej stronie ──────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const pH = doc.internal.pageSize.getHeight()
    doc.setFillColor(...LIGHT_GRAY)
    doc.rect(0, pH - 9, W, 9, 'F')
    doc.setDrawColor(...MID_GRAY)
    doc.line(0, pH - 9, W, pH - 9)
    doc.setFontSize(7)
    setN()
    doc.setTextColor(120, 120, 120)
    doc.text('ON Gaz Sp. z o.o.', marginL, pH - 3)
    doc.text(`Strona ${i} / ${pageCount}`, W / 2, pH - 3, { align: 'center' })
    doc.text(`Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`, W - marginR, pH - 3, { align: 'right' })
  }

  // ── Zapisz ────────────────────────────────────────────────────────────────
  const filename = `Kosztorys_${kos.numer.replace(/\//g, '-')}_${kos.nazwa.slice(0, 30).replace(/\s+/g, '_')}.pdf`
  doc.save(filename)
}
