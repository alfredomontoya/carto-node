import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/server/auth/dal'

const rutasProtegidas = ['/dashboard', '/areas', '/usuarios', '/documentos', '/contadores']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const autenticado = Boolean(token)

  const protegida = rutasProtegidas.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  if (protegida && !autenticado) {
    const url = new URL('/login', request.url)
    return NextResponse.redirect(url)
  }

  if (pathname === '/login' && autenticado) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}