import { promises as dns } from 'dns'
import net from 'net'

// Pobieranie adresów podanych przez użytkownika po stronie serwera (SSRF): tylko https, tylko adresy publiczne,
// przekierowania sprawdzane ręcznie. Blokuje localhost, sieci prywatne, link-local (w tym metadane chmury 169.254.x.x).
function prywatny(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const l = ip.toLowerCase()
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:')
}

export async function sprawdzUrl(raw: string): Promise<URL> {
  let u: URL
  try { u = new URL(raw) } catch { throw new Error('Niepoprawny adres URL') }
  if (u.protocol !== 'https:') throw new Error('Dozwolone są tylko adresy https')
  const host = u.hostname
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Adres niedozwolony')
  if (net.isIP(host)) { if (prywatny(host)) throw new Error('Adres niedozwolony'); return u }
  const adresy = await dns.lookup(host, { all: true })
  if (!adresy.length || adresy.some(a => prywatny(a.address))) throw new Error('Adres niedozwolony')
  return u
}

export async function bezpiecznyFetch(raw: string, init: RequestInit = {}, maxPrzekierowan = 3): Promise<Response> {
  let url = (await sprawdzUrl(raw)).toString()
  for (let i = 0; i <= maxPrzekierowan; i++) {
    const res = await fetch(url, { ...init, redirect: 'manual' })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = (await sprawdzUrl(new URL(res.headers.get('location')!, url).toString())).toString()
      continue
    }
    return res
  }
  throw new Error('Zbyt wiele przekierowań')
}
