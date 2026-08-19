'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireModule } from '@/server/auth/dal'
import { repos } from '@/server/repo'
import { AreaService } from '@/server/services/area.service'
import { resultadoError, success, type ActionResult } from './helpers'

const area = new AreaService(repos)

const areaSchema = z.object({
  name: z.string().min(3, 'El nombre es obligatorio (mín. 3 caracteres).').trim(),
  sigla: z.string().min(2, 'La sigla es obligatoria (mín. 2 caracteres).').trim().transform((s) => s.toUpperCase()),
  description: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
  parentId: z.string().nullable().optional(),
  numeracionMode: z.enum(['propia', 'hereda']),
  reiniciaAnualmente: z.boolean().optional().default(true),
})

export async function crearAreaAction(input: z.infer<typeof areaSchema>): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const actor = await requireModule('areas')
    const parsed = areaSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: 'Datos inválidos del área.', fieldErrors: parsed.error.flatten().fieldErrors }
    }
    if (actor.role !== 'admin' && parsed.data.numeracionMode === 'propia') {
      // la config de numeración es solo admin; para usuarios se fuerza herencia o padre existente
      return { ok: false, error: 'Solo el administrador puede configurar la numeración.' }
    }
    const creada = await area.crear(parsed.data)
    revalidatePath('/areas')
    return success({ id: creada.id, name: creada.name })
  } catch (e) {
    return resultadoError(e)
  }
}

export async function actualizarAreaAction(id: string, input: z.infer<typeof areaSchema>): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const actor = await requireModule('areas')
    const parsed = areaSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: 'Datos inválidos del área.', fieldErrors: parsed.error.flatten().fieldErrors }
    }
    if (actor.role !== 'admin') {
      return { ok: false, error: 'Solo el administrador puede modificar áreas.' }
    }
    const actualizada = await area.actualizar(id, parsed.data)
    revalidatePath('/areas')
    return success({ id: actualizada.id, name: actualizada.name })
  } catch (e) {
    return resultadoError(e)
  }
}

export async function eliminarAreaAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await requireModule('areas')
    const actor = await requireModule('areas')
    if (actor.role !== 'admin') return { ok: false, error: 'Solo el administrador puede eliminar áreas.' }
    await area.eliminar(id)
    revalidatePath('/areas')
    return success({ id })
  } catch (e) {
    return resultadoError(e)
  }
}

const puestoSchema = z.object({
  name: z.string().min(2).trim(),
  sigla: z.string().min(1).trim().transform((s) => s.toUpperCase()),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
})

export async function crearPuestoAction(areaId: string, input: z.infer<typeof puestoSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    await requireModule('areas')
    const parsed = puestoSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'Datos inválidos del puesto.', fieldErrors: parsed.error.flatten().fieldErrors }
    const puesto = await area.crearPuesto(areaId, {
      name: parsed.data.name,
      sigla: parsed.data.sigla,
      description: parsed.data.description ?? undefined,
    })
    revalidatePath('/areas')
    return success({ id: puesto.id })
  } catch (e) {
    return resultadoError(e)
  }
}

export async function actualizarPuestoAction(areaId: string, puestoId: string, input: z.infer<typeof puestoSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    await requireModule('areas')
    const parsed = puestoSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'Datos inválidos del puesto.', fieldErrors: parsed.error.flatten().fieldErrors }
    const puesto = await area.actualizarPuesto(areaId, puestoId, parsed.data)
    revalidatePath('/areas')
    return success({ id: puesto.id })
  } catch (e) {
    return resultadoError(e)
  }
}

export async function eliminarPuestoAction(areaId: string, puestoId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await requireModule('areas')
    await area.eliminarPuesto(areaId, puestoId)
    revalidatePath('/areas')
    return success({ id: puestoId })
  } catch (e) {
    return resultadoError(e)
  }
}