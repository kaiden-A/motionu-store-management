import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest, isAdmin } from '@/lib/auth'

const ADMIN_PREFIXES = ['/stats', '/setup', '/preorders']

export async function proxy(request: NextRequest) {
  const session = await getSessionFromRequest(request)

  const { pathname } = request.nextUrl

  const isProtected = !pathname.startsWith('/api/') && pathname !== '/login'
  const isLoginRoute = pathname === '/login'

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isLoginRoute && session) {
    return NextResponse.redirect(new URL('/events', request.url))
  }

  if (session) {
    for (const prefix of ADMIN_PREFIXES) {
      if (pathname.startsWith(prefix) && !isAdmin(session.roles)) {
        return NextResponse.redirect(new URL('/events', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|pinpoint.html).*)',
  ],
}
