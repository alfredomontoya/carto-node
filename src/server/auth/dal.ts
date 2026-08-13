import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Modulo, SesionUsuario } from '@/server/domain/constants'
import { canModule } from '@/server/domain/constants'
import { forbidden } from '@/server/domain/errors'
import { repos } from '@/server/repo/drizzle'
import { AuthService } from '@/server/services/auth.service'

const auth = new AuthService(repos)

export const SESSION_COOKIE = process.env.SESSION_COOKIE ?? 'carto_session'

export const getCurrentUser = cache(async (): Promise<SesionUsuario | null> => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  return auth.verificarToken(token)
})

export async function requireUser(): Promise<SesionUsuario> {
  const usuario = await getCurrentUser()
  if (!usuario || !usuario.active) {
    redirect('/login')
  }
  return usuario
}

export async function requireAdmin(): Promise<SesionUsuario> {
  const usuario = await requireUser()
  if (usuario.role !== 'admin') {
    throw forbidden('Se requieren permisos de administrador.')
  }
  return usuario
}

export async function requireModule(modulo: Modulo): Promise<SesionUsuario> {
  const usuario = await requireUser()
  if (!canModule(usuario, modulo)) {
    throw forbidden(`No tienes acceso al módulo "${modulo}".`)
  }
  return usuario
}