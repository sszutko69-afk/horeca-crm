'use client'

// Używamy PDFWorker({ port }) zamiast GlobalWorkerOptions.workerSrc
// – pomija problem z Turbopack tworzącym dwie instancje modułu (prywatne pola klas)
export async function extractPdfText(file: File, maxPages = 30): Promise<string> {
  const pdfjs = await import('pdfjs-dist')

  // Tworzymy Worker bezpośrednio i przekazujemy do PDFWorker
  // getDocument z worker= nie korzysta z GlobalWorkerOptions.workerSrc
  const rawWorker = new Worker('/pdf.worker.min.mjs', { type: 'module' })
  const pdfWorker = new pdfjs.PDFWorker({ port: rawWorker as unknown as null })

  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      worker: pdfWorker,
      useSystemFonts: true,
    }).promise

    const numPages = Math.min(pdf.numPages, maxPages)
    const lines: string[] = []

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .trim()
      if (pageText) lines.push(pageText)
    }

    await pdf.destroy()
    return lines.join('\n')
  } finally {
    pdfWorker.destroy()
    rawWorker.terminate()
  }
}
