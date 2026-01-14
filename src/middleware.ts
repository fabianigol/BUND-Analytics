import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  console.log('🔍 Middleware Debug:', {
    url: request.nextUrl.pathname,
    hasSupabaseUrl: !!supabaseUrl,
    hasSupabaseKey: !!supabaseKey,
  })
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('⚠️ Supabase not configured, allowing all routes')
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log('👤 User status:', {
    hasUser: !!user,
    email: user?.email,
  })

  // Protected routes
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isPublicRoute = request.nextUrl.pathname.startsWith('/api')
  const isPrivacyPage = request.nextUrl.pathname === '/privacidad'

  if (!user && !isAuthPage && !isPublicRoute && !isPrivacyPage) {
    console.log('🔒 Redirecting to login')
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    console.log('✅ User logged in, redirecting to dashboard')
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

