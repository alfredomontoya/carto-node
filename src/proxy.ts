import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/server/auth/dal'
import { repos } from '@/server/repo/drizzle'
import { AuthService } from '@/server/services/auth.service'

const rutasProtegidas = ['/dashboard', '/areas', '/usuarios', '/documentos', '/contadores']

const auth = new AuthService(repos)

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const autenticado = Boolean(token)

  const protegida = rutasProtegidas.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  if (protegida && !autenticado) {
    const url = new URL('/login', request.url)
    return NextResponse.redirect(url)
  }

  // Solo redirige a /dashboard si la sesión realmente existe en la base.
  // Evita un bucle /dashboard <-> /login cuando la cookie es caducada o inválida.
  if (pathname === '/login' && token) {
    try {
      const usuario = await auth.verificarToken(token)
      if (usuario) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } catch {
      // si la verificación falla, se deja pasar al login
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}