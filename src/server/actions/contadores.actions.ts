'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth/dal'
import { repos } from '@/server/repo/drizzle'
import { ContadorService } from '@/server/services/contador.service'
import { resultadoError, success, type ActionResult } from './helpers'

const contadores = new ContadorService(repos)

const reiniciarSchema = z.object({
  areaId: z.number().int().positive(),
  tipo: z.enum(['ci', 'of']),
  glosa: z.string().min(3, 'La glosa debe tener al menos 3 caracteres.').trim(),
})

export async function reiniciarContadorAction(
  input: z.infer<typeof reiniciarSchema>,
): Promise<ActionResult<{ areaId: number; tipo: 'ci' | 'of' }>> {
  try {
    const admin = await requireAdmin()
    const parsed = reiniciarSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'Revisa los datos.', fieldErrors: parsed.error.flatten().fieldErrors }

    await contadores.reiniciar(parsed.data.areaId, parsed.data.tipo, parsed.data.glosa, admin.id)
    revalidatePath('/contadores')
    return success({ areaId: parsed.data.areaId, tipo: parsed.data.tipo })
  } catch (e) {
    return resultadoError(e)
  }
}