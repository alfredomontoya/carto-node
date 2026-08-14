'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth/dal'
import type { HorarioDisponibilidad } from '@/server/domain/constants'
import { repos } from '@/server/repo'
import { SistemaService } from '@/server/services/sistema.service'
import { resultadoError, success, type ActionResult } from './helpers'

const sistema = new SistemaService(repos)

const horarioSchema = z.object({
  habilitado: z.boolean(),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  dias: z.array(z.number().int().min(0).max(6)).min(1),
})

export async function guardarHorarioAction(
  input: z.infer<typeof horarioSchema>,
): Promise<ActionResult<void>> {
  try {
    await requireAdmin()
    const parsed = horarioSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: 'Revisa los datos.', fieldErrors: parsed.error.flatten().fieldErrors }
    }
    const datos: HorarioDisponibilidad = parsed.data
    await sistema.guardarHorario(datos)
    revalidatePath('/configuracion')
    return success(undefined)
  } catch (e) {
    return resultadoError(e)
  }
}
