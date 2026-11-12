import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { liczDostep, czySciezkaPodstawowa, type FirmaPlan } from '@/lib/plany'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const PUBLICZNE = ['/login', '/rejestracja', '/reset-hasla', '/regulamin', '/polityka-prywatnosci', '/o-aplikacji', '/auth', '/api/stripe/webhook']
  const isPublic = PUBLICZNE.some(p => path === p || path.startsWith(p + '/')) ||
    path.startsWith('/_next') || path.startsWith('/favicon') || /\.(png|jpg|svg|ico|json|webmanifest|js|css|txt|mjs)$/.test(path)

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Wersja podstawowa (po okresie próbnym bez subskrypcji): moduły rozszerzone są zablokowane
  if (user && !isPublic && !path.startsWith('/api')) {
    const { data: firma } = await supabase
      .from('firmy')
      .select('id,nazwa,demo,status,trial_do,stripe_status,subskrypcja_do')
      .maybeSingle()
    const dostep = liczDostep(firma as FirmaPlan | null)
    if (dostep.wersja === 'podstawowa' && !czySciezkaPodstawowa(path)) {
      return NextResponse.redirect(new URL('/subskrypcja?zablokowane=1', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
