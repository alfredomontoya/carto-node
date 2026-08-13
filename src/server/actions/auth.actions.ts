'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { SESSION_COOKIE, getCurrentUser, requireUser } from '@/server/auth/dal'
import { repos } from '@/server/repo/drizzle'
import { AuthService } from '@/server/services/auth.service'
import { resultadoError, type ActionResult } from './helpers'

const auth = new AuthService(repos)

export async function loginAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const schema = z.object({
    email: z.string().email('Ingresa un correo válido.'),
    password: z.string().min(1, 'Ingresa tu contraseña.'),
  })
  const parsed = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { ok: false, error: 'Revisa los datos.', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  try {
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
    const { token } = await auth.login(parsed.data.email, parsed.data.password, ip)

    const prod = process.env.NODE_ENV === 'production'
    const store = await cookies()
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: prod,
      sameSite: 'lax',
      path: '/',
      maxAge: Number(process.env.SESSION_TTL_DAYS ?? 7) * 24 * 60 * 60,
    })
  } catch (e) {
    return resultadoError(e)
  }

  redirect('/dashboard')
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