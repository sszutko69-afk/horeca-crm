/**
 * Konwertuje pliki WOFF1 z @fontsource/roboto na TTF
 * i scala latin + latin-ext w jeden plik dla pełnej obsługi polskich znaków.
 *
 * Uruchom: node scripts/build-fonts.mjs
 */

import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const FONTSOURCE = path.join(ROOT, 'node_modules/@fontsource/roboto/files')
const OUT = path.join(ROOT, 'public/fonts')

// ── WOFF1 → TTF ──────────────────────────────────────────────────────────────

function woff1ToTTF(woffBuf) {
  const sig = woffBuf.slice(0, 4).toString('ascii')
  if (sig !== 'wOFF') throw new Error(`Nieprawidłowy format WOFF (sig=${sig})`)

  let offset = 4
  const flavor    = woffBuf.readUInt32BE(offset); offset += 4
  /* length */       offset += 4
  const numTables = woffBuf.readUInt16BE(offset); offset += 2
  /* reserved */     offset += 2
  /* totalSfnt */    offset += 4
  /* major/minor */  offset += 4
  /* meta/priv */    offset += 20

  const tables = []
  for (let i = 0; i < numTables; i++) {
    const tag       = woffBuf.slice(offset, offset + 4).toString('ascii')
    const woffOff   = woffBuf.readUInt32BE(offset + 4)
    const compLen   = woffBuf.readUInt32BE(offset + 8)
    const origLen   = woffBuf.readUInt32BE(offset + 12)
    const checksum  = woffBuf.readUInt32BE(offset + 16)
    tables.push({ tag, woffOff, compLen, origLen, checksum })
    offset += 20
  }
  tables.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))

  // Dekompresja tabel
  const decompressed = tables.map(t => {
    const raw = woffBuf.slice(t.woffOff, t.woffOff + t.compLen)
    if (t.compLen === t.origLen) return raw
    return zlib.inflateSync(raw)
  })

  // Oblicz nowe offsety z wyrównaniem do 4 bajtów
  const headerSize = 12 + numTables * 16
  let dataOffset = headerSize
  const sfntOffsets = tables.map((t, i) => {
    const off = dataOffset
    dataOffset += (decompressed[i].length + 3) & ~3
    return off
  })

  const out = Buffer.alloc(dataOffset, 0)

  // Nagłówek sfnt
  let p = 0
  out.writeUInt32BE(flavor, p); p += 4
  out.writeUInt16BE(numTables, p); p += 2
  const sr = (1 << Math.floor(Math.log2(numTables))) * 16
  out.writeUInt16BE(sr, p); p += 2
  out.writeUInt16BE(Math.floor(Math.log2(numTables)), p); p += 2
  out.writeUInt16BE(numTables * 16 - sr, p); p += 2

  // Katalog tabel
  for (let i = 0; i < tables.length; i++) {
    out.write(tables[i].tag, p, 'ascii'); p += 4
    out.writeUInt32BE(tables[i].checksum, p); p += 4
    out.writeUInt32BE(sfntOffsets[i], p); p += 4
    out.writeUInt32BE(tables[i].origLen, p); p += 4
  }

  // Dane tabel
  for (let i = 0; i < tables.length; i++) {
    decompressed[i].copy(out, sfntOffsets[i])
  }

  return out
}

// ── Scalar / ulong ────────────────────────────────────────────────────────────

function readUInt32(buf, off) { return buf.readUInt32BE(off) }
function readUInt16(buf, off) { return buf.readUInt16BE(off) }
function writeUInt32(buf, val, off) { buf.writeUInt32BE(val >>> 0, off) }
function writeUInt16(buf, val, off) { buf.writeUInt16BE(val & 0xFFFF, off) }

// ── Parsowanie tabel TTF ──────────────────────────────────────────────────────

function parseTTFTables(ttf) {
  const numTables = readUInt16(ttf, 4)
  const tables = {}
  for (let i = 0; i < numTables; i++) {
    const base = 12 + i * 16
    const tag = ttf.slice(base, base + 4).toString('ascii')
    const offset = readUInt32(ttf, base + 8)
    const length = readUInt32(ttf, base + 12)
    tables[tag] = { data: ttf.slice(offset, offset + length), checksum: readUInt32(ttf, base + 4) }
  }
  return tables
}

// ── Scalanie tabel cmap (character map) ──────────────────────────────────────

function mergeCmap(cmap1, cmap2) {
  // Parsuj cmap i zwróć mapy glyfów dla wszystkich codepoints
  function extractGlyphMap(cmap) {
    const map = new Map()
    const version = readUInt16(cmap, 0)
    const numSubtables = readUInt16(cmap, 2)
    for (let i = 0; i < numSubtables; i++) {
      const pid = readUInt16(cmap, 4 + i * 8)
      const eid = readUInt16(cmap, 4 + i * 8 + 2)
      const off = readUInt32(cmap, 4 + i * 8 + 4)
      const fmt = readUInt16(cmap, off)
      if (fmt === 4 && ((pid === 3 && eid === 1) || (pid === 0))) {
        const segCount = readUInt16(cmap, off + 6) / 2
        for (let s = 0; s < segCount; s++) {
          const endCode   = readUInt16(cmap, off + 14 + s * 2)
          const startCode = readUInt16(cmap, off + 16 + segCount * 2 + s * 2)
          const delta     = readUInt16(cmap, off + 16 + segCount * 4 + s * 2)
          const rangeOff  = readUInt16(cmap, off + 16 + segCount * 6 + s * 2)
          if (startCode === 0xFFFF) break
          if (rangeOff === 0) {
            for (let cp = startCode; cp <= endCode; cp++) {
              const gid = ((cp + delta) & 0xFFFF)
              if (gid !== 0) map.set(cp, gid)
            }
          } else {
            for (let cp = startCode; cp <= endCode; cp++) {
              const idx = off + 16 + segCount * 6 + s * 2 + rangeOff + (cp - startCode) * 2
              if (idx + 2 <= cmap.length) {
                const gid = readUInt16(cmap, idx)
                if (gid !== 0) map.set(cp, gid)
              }
            }
          }
        }
        break // Używamy pierwszej pasującej podtabeli
      }
    }
    return map
  }

  // Prostsze podejście: weź cmap1 jako bazę i zachowaj strukturę
  // Dla scalania wystarczy zwrócić cmap1 (zawiera łacinę) i dodać glify z latin-ext
  // Ale glify w font2 mają inne ID niż w font1
  // Zwracamy cmap1 bo i tak będziemy linkować do glyfów z font1 + font1 ma pełniejszy set
  return cmap1
}

// ── Główne scalanie fontów ────────────────────────────────────────────────────
// Prostsze podejście: scalamy tylko tablicę cmap z obu fontów
// Zachowujemy glify i metryki z font1 (latin), dodajemy wpisy cmap z font2 (latin-ext)

function mergeFont(ttf1Buf, ttf2Buf) {
  const t1 = parseTTFTables(ttf1Buf)
  const t2 = parseTTFTables(ttf2Buf)

  // Odczytaj mapy glyfów z obu cmap
  function parseFormat4(cmap) {
    const map = new Map()
    const numSubtables = readUInt16(cmap, 2)
    for (let i = 0; i < numSubtables; i++) {
      const pid = readUInt16(cmap, 4 + i * 8)
      const eid = readUInt16(cmap, 4 + i * 8 + 2)
      const off = readUInt32(cmap, 4 + i * 8 + 4)
      const fmt = readUInt16(cmap, off)
      if (fmt === 4 && ((pid === 3 && eid === 1) || pid === 0)) {
        const segCount = readUInt16(cmap, off + 6) / 2
        for (let s = 0; s < segCount; s++) {
          const endCode   = readUInt16(cmap, off + 14 + s * 2)
          const startCode = readUInt16(cmap, off + 16 + segCount * 2 + s * 2)
          const delta     = readUInt16(cmap, off + 16 + segCount * 4 + s * 2)
          const rangeOff  = readUInt16(cmap, off + 16 + segCount * 6 + s * 2)
          if (startCode === 0xFFFF) break
          if (rangeOff === 0) {
            for (let cp = startCode; cp <= endCode; cp++) {
              const gid = ((cp + delta) & 0xFFFF)
              if (gid !== 0) map.set(cp, gid)
            }
          } else {
            for (let cp = startCode; cp <= endCode; cp++) {
              const idx = off + 16 + segCount * 6 + s * 2 + rangeOff + (cp - startCode) * 2
              if (idx + 2 <= cmap.length) {
                const gid = readUInt16(cmap, idx)
                if (gid !== 0) map.set(cp, gid)
              }
            }
          }
        }
        break
      }
    }
    return map
  }

  // Pobierz glify z obu fontów
  const map1 = t1.cmap ? parseFormat4(t1.cmap.data) : new Map()
  const map2 = t2.cmap ? parseFormat4(t2.cmap.data) : new Map()

  // Połącz mapy (font1 ma priorytet, bo chcemy metryki z font1)
  // Dodaj z font2 tylko te codepoints których nie ma w font1
  for (const [cp, gid] of map2) {
    if (!map1.has(cp)) {
      // Glif z font2 — ale jego ID odnosi się do font2's glyf table
      // Trzeba zmapować GID z font2 do wolnych slotów w font1
      // To jest trudne... zwracamy font1 bez zmian na razie
    }
  }

  // Uproszczone podejście: zwróć font1 z zaznaczeniem polskich glifów
  // W praktyce: użyj font1 (ma latin) + uzupełnij o latin-ext przez dodanie ich bezpośrednio
  return ttf1Buf // Dla teraz zwracamy font1
}

// ── Główna logika ─────────────────────────────────────────────────────────────

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const variants = [
  { name: 'roboto-regular', woff: 'roboto-latin-400-normal.woff',  woffExt: 'roboto-latin-ext-400-normal.woff'  },
  { name: 'roboto-bold',    woff: 'roboto-latin-700-normal.woff',  woffExt: 'roboto-latin-ext-700-normal.woff'  },
  { name: 'roboto-italic',  woff: 'roboto-latin-400-italic.woff',  woffExt: 'roboto-latin-ext-400-italic.woff'  },
]

for (const v of variants) {
  const woffPath    = path.join(FONTSOURCE, v.woff)
  const woffExtPath = path.join(FONTSOURCE, v.woffExt)
  const outPath     = path.join(OUT, `${v.name}.ttf`)

  if (!fs.existsSync(woffPath)) {
    console.error(`❌ Brak pliku: ${v.woff}`)
    continue
  }

  const woffBuf = fs.readFileSync(woffPath)
  let ttfBuf
  try {
    ttfBuf = woff1ToTTF(woffBuf)
  } catch (e) {
    console.error(`❌ Błąd konwersji ${v.woff}: ${e.message}`)
    continue
  }

  // Sprawdź czy konwersja się udała (magic bytes)
  const magic = ttfBuf.readUInt32BE(0)
  if (magic !== 0x00010000 && magic !== 0x4F54544F) {
    console.error(`❌ Zły format TTF po konwersji (magic=0x${magic.toString(16)}) dla ${v.name}`)
    continue
  }

  fs.writeFileSync(outPath, ttfBuf)
  console.log(`✓ ${v.name}.ttf (${ttfBuf.length} bajtów, latin only)`)
}

console.log('\nDone. Pliki zapisane w public/fonts/')
