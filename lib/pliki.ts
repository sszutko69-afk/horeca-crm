// Pliki w magazynie (Supabase Storage): w bazie zapisane są adresy w postaci
// https://<projekt>.supabase.co/storage/v1/object/public/<bucket>/<ścieżka>. Buckety są PRYWATNE, więc taki adres sam nie otwiera pliku:
// do otwarcia służy /api/pliki/otworz (sprawdza sesję i firmę, tworzy krótkotrwały podpisany link).
const DOZWOLONE_BUCKETY = ['dokumenty', 'firma']

export function rozbierzUrlPliku(url: string): { bucket: string; path: string } | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (!url || !base || !url.startsWith(base)) return null
  const m = url.slice(base.length).match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?.*)?$/)
  if (!m || !DOZWOLONE_BUCKETY.includes(m[1])) return null
  try { return { bucket: m[1], path: decodeURIComponent(m[2]) } } catch { return null }
}

// Adres do użycia w href/src: plik z magazynu przechodzi przez /api/pliki/otworz, inne adresy (zewnętrzne linki) bez zmian.
export function plikHref(url: string, pobierz = false): string {
  return rozbierzUrlPliku(url) ? `/api/pliki/otworz?u=${encodeURIComponent(url)}${pobierz ? '&pobierz=1' : ''}` : url
}
