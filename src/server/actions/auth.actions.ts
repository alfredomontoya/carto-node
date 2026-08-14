'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { SESSION_COOKIE, TEMA_COOKIE, getCurrentUser, requireUser } from '@/server/auth/dal'
import { AppError } from '@/server/domain/errors'
import { repos } from '@/server/repo'
import { AuthService } from '@/server/services/auth.service'
import { SistemaService } from '@/server/services/sistema.service'
import { resultadoError, type ActionResult } from './helpers'

const auth = new AuthService(repos)
const sistema = new SistemaService(repos)

export async function loginAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const schema = z.object({
    usuario: z.string().min(1, 'Ingresa tu usuario.'),
    password: z.string().min(1, 'Ingresa tu contraseña.'),
    next: z.string().optional(),
  })
  const parsed = schema.safeParse({
    usuario: formData.get('usuario'),
    password: formData.get('password'),
    next: typeof formData.get('next') === 'string' ? formData.get('next') : undefined,
  })
  if (!parsed.success) {
    return { ok: false, error: 'Revisa los datos.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const nextRaw = parsed.data.next
  const destino =
    nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//') && nextRaw.length <= 200
      ? nextRaw
      : '/dashboard'

  try {
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
    const { token, usuario } = await auth.login(parsed.data.usuario, parsed.data.password, ip)

    if (usuario.role !== 'admin' && !(await sistema.estaDisponible())) {
      await auth.cerrarSesion(token)
      throw new AppError(await sistema.mensajeHorario(), 'AUTH', 403)
    }

    const prod = process.env.NODE_ENV === 'production'
    const store = await cookies()
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: prod,
      sameSite: 'lax',
      path: '/',
      maxAge: Number(process.env.SESSION_TTL_DAYS ?? 7) * 24 * 60 * 60,
    })
    store.set(TEMA_COOKIE, usuario.theme, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    })
  } catch (e) {
    return resultadoError(e)
  }

  redirect(destino)
}

export async function logoutAction(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    await auth.cerrarSesion(token)
  }
  store.delete(SESSION_COOKIE)
  redirect('/login')
}

export async function obtenerUsuarioActual() {
  return getCurrentUser()
}

export async function quienSoyClient() {
  const usuario = await requireUser()
  return {
    id: usuario.id,
    name: usuario.name,
    email: usuario.email,
    role: usuario.role,
    modules: usuario.modules,
    asignacionActiva: usuario.asignacionActiva,
  }
}