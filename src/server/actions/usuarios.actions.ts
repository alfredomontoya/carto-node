'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireModule } from '@/server/auth/dal'
import { repos } from '@/server/repo'
import { UsuarioService } from '@/server/services/usuario.service'
import { resultadoError, success, type ActionResult } from './helpers'

const usuarios = new UsuarioService(repos)

const userSchema = z.object({
  name: z.string().min(3, 'Nombre obligatorio.').trim(),
  email: z.string().email('Correo inválido.').optional().or(z.literal('')),
  password: z.string().min(6, 'Mínimo 6 caracteres').optional().or(z.literal('')),
  role: z.enum(['admin', 'user', 'guest']),
  active: z.boolean().optional(),
  modules: z.array(z.string()).default([]),
  areaId: z.number().nullable().optional(),
  puestoId: z.number().nullable().optional(),
})

export async function crearUsuarioAction(input: z.infer<typeof userSchema>): Promise<ActionResult<{ id: number }>> {
  try {
    await requireModule('usuarios')
    const parsed = userSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'Revisa los datos.', fieldErrors: parsed.error.flatten().fieldErrors }
    if (parsed.data.active === false) {
      return { ok: false, error: 'Al crear un usuario debe estar activo.' }
    }
    const creado = await usuarios.crear({
      name: parsed.data.name,
      email: parsed.data.email || undefined,
      password: parsed.data.password || undefined,
      role: parsed.data.role,
      modules: parsed.data.modules,
      areaId: parsed.data.areaId ?? null,
      puestoId: parsed.data.puestoId ?? null,
    })
    revalidatePath('/usuarios')
    return success({ id: creado.id })
  } catch (e) {
    return resultadoError(e)
  }
}

export async function actualizarUsuarioAction(
  id: number,
  input: z.infer<typeof userSchema>,
): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await requireModule('usuarios')
    if (actor.id === id && input.active === false) {
      return { ok: false, error: 'No puedes desactivar tu propio usuario.' }
    }
    const parsed = userSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'Revisa los datos.', fieldErrors: parsed.error.flatten().fieldErrors }
    await usuarios.actualizar(id, {
      name: parsed.data.name,
      email: parsed.data.email || undefined,
      role: parsed.data.role,
      active: parsed.data.active ?? true,
      modules: parsed.data.modules,
      areaId: parsed.data.areaId ?? null,
      puestoId: parsed.data.puestoId ?? null,
    })
    revalidatePath('/usuarios')
    return success({ id })
  } catch (e) {
    return resultadoError(e)
  }
}

export async function resetPasswordAction(id: number, password: string): Promise<ActionResult<{ id: number }>> {
  try {
    await requireModule('usuarios')
    if (!password || password.length < 6) {
      return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.', fieldErrors: { password: ['Mínimo 6 caracteres.'] } }
    }
    await usuarios.resetPassword(id, password)
    revalidatePath('/usuarios')
    return success({ id })
  } catch (e) {
    return resultadoError(e)
  }
}

export async function eliminarUsuarioAction(id: number): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await requireModule('usuarios')
    await usuarios.eliminar(id, actor.id)
    revalidatePath('/usuarios')
    return success({ id })
  } catch (e) {
    return resultadoError(e)
  }
}

export async function asignarAreaAction(userId: number, areaId: number, puestoId: number | null): Promise<ActionResult<void>> {
  try {
    const actor = await requireModule('usuarios')
    void actor
    await usuarios.asignarArea(userId, areaId, puestoId)
    revalidatePath('/usuarios')
    return success(undefined)
  } catch (e) {
    return resultadoError(e)
  }
}