'use server'

import { cookies } from 'next/headers'
import { TEMA_COOKIE, requireUser } from '@/server/auth/dal'
import { TEMAS } from '@/server/domain/constants'
import { repos } from '@/server/repo'
import { resultadoError, success, type ActionResult } from './helpers'

export async function setTemaAction(tema: string): Promise<ActionResult<{ tema: string }>> {
  try {
    if (!(TEMAS as readonly string[]).includes(tema)) {
      return { ok: false, error: 'Tema inválido.' }
    }
    const usuario = await requireUser()
    await repos.users.update(usuario.id, { theme: tema })
    const store = await cookies()
    store.set(TEMA_COOKIE, tema, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    })
    return success({ tema })
  } catch (e) {
    return resultadoError(e)
  }
}
