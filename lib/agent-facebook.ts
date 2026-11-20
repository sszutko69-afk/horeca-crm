import { createHmac } from 'crypto'

// Podpis adresu grafiki posta (HMAC z CRON_SECRET), żeby nie dało się generować dowolnych obrazów na naszej domenie.
export function podpisGrafiki(t: string, b: string): string {
  return createHmac('sha256', process.env.CRON_SECRET ?? '').update(`${t}|${b}`).digest('hex').slice(0, 32)
}
