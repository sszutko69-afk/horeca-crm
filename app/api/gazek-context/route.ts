import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  try {
    // Get user from auth header (forwarded by client)
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ userName: '', items: [] })

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ userName: '', items: [] })

    const supabase = getSupabase()

    // Fetch user name
    const { data: profile } = await supabase
      .from('profiles')
      .select('imie_nazwisko')
      .eq('id', user.id)
      .single()

    const fullName: string = profile?.imie_nazwisko ?? ''
    const userName = fullName.split(' ')[0] || fullName || ''

    const today = new Date().toISOString().split('T')[0]
    const in7  = new Date(Date.now() + 7  * 86400000).toISOString().split('T')[0]
    const in3  = new Date(Date.now() + 3  * 86400000).toISOString().split('T')[0]
    const in14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]

    // Run all queries in parallel, graceful on failure
    const [przetargiRes, zadaniaRes, zadOvRes, kosztRes] = await Promise.allSettled([
      // Przetargi kończące się w ciągu 7 dni
      supabase
        .from('przetargi')
        .select('id, tytul, data_skladania, status')
        .eq('usuniete', false)
        .gte('data_skladania', today)
        .lte('data_skladania', in7)
        .not('status', 'in', '("pominiety","przegrany","wygrany")')
        .order('data_skladania')
        .limit(5),

      // Otwarte zadania CRM z terminem w ciągu 7 dni
      supabase
        .from('crm_zadania')
        .select('id, tytul, termin', { count: 'exact' })
        .in('status', ['otwarte', 'w_trakcie'])
        .gte('termin', today)
        .lte('termin', in7)
        .limit(5),

      // Przeterminowane zadania CRM
      supabase
        .from('crm_zadania')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'otwarte')
        .lt('termin', today),

      // Kosztorysy (ostatnie 30 dni)
      supabase
        .from('kosztorysy')
        .select('id, nazwa', { count: 'exact' })
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
        .order('created_at', { ascending: false })
        .limit(3),
    ])

    const items: Array<{ type: 'alert' | 'warning' | 'info'; text: string; href: string; icon: string; detail?: string; rekordId?: string; rekordTyp?: string; data?: string }> = []

    // Przeterminowane zadania CRM
    if (zadOvRes.status === 'fulfilled') {
      const count = zadOvRes.value.count ?? 0
      if (count > 0) {
        items.push({
          type: 'alert',
          icon: '📞',
          text: count === 1
            ? '1 zadanie CRM jest przeterminowane!'
            : `${count} zadań CRM jest przeterminowanych!`,
          href: '/crm',
        })
      }
    }

    // Przetargi kończące się wkrótce
    if (przetargiRes.status === 'fulfilled') {
      const przt = przetargiRes.value.data ?? []
      const krityczne = przt.filter(p => p.data_skladania <= in3)
      const pozostale = przt.filter(p => p.data_skladania >  in3)

      for (const p of krityczne) {
        const daysLeft = Math.ceil((new Date(p.data_skladania).getTime() - Date.now()) / 86400000)
        items.push({
          type: 'alert',
          icon: '⏰',
          text: daysLeft <= 1
            ? `Przetarg kończy się DZIŚ!`
            : `Przetarg kończy się za ${daysLeft} dni!`,
          detail: p.tytul?.slice(0, 60) + (p.tytul?.length > 60 ? '…' : ''),
          href: `/przetargi?open=${p.id}`,
          rekordId: p.id,
          rekordTyp: 'przetarg',
          data: p.data_skladania,
        })
      }

      if (pozostale.length > 0) {
        items.push({
          type: 'warning',
          icon: '📋',
          text: `${pozostale.length} przetarg${pozostale.length > 1 ? 'i' : ''} w ciągu tygodnia`,
          href: '/przetargi',
        })
      }
    }

    // Zadania CRM upcoming
    if (zadaniaRes.status === 'fulfilled') {
      const count = zadaniaRes.value.count ?? 0
      if (count > 0) {
        items.push({
          type: 'warning',
          icon: '✅',
          text: `${count} zadanie${count > 1 ? (count < 5 ? 'a' : '') : ''} CRM w tym tygodniu`,
          href: '/crm',
        })
      }
    }

    // Kosztorysy
    if (kosztRes.status === 'fulfilled') {
      const count = kosztRes.value.count ?? 0
      if (count > 0) {
        items.push({
          type: 'info',
          icon: '📄',
          text: `${count} kosztorys${count > 1 ? (count < 5 ? 'y' : 'ów') : ''} w ostatnim miesiącu`,
          href: '/kosztorysowanie',
        })
      }
    }

    return NextResponse.json({ userName, items })
  } catch (e: any) {
    console.error('[gazek-context]', e)
    return NextResponse.json({ userName: '', items: [] })
  }
}
