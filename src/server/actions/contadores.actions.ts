'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth/dal'
import { repos } from '@/server/repo'
import { ContadorService } from '@/server/services/contador.service'
import { resultadoError, success, type ActionResult } from './helpers'

const contadores = new ContadorService(repos)

const reiniciarSchema = z.object({
  areaId: z.string(),
  tipo: z.enum(['ci', 'of']),
  glosa: z.string().min(3, 'La glosa debe tener al menos 3 caracteres.').trim(),
  force: z.boolean().default(false),
})

export async function reiniciarContadorAction(
  input: z.input<typeof reiniciarSchema>,
): Promise<ActionResult<{ areaId: string; tipo: 'ci' | 'of' }>> {
  try {
    const admin = await requireAdmin()
    const parsed = reiniciarSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'Revisa los datos.', fieldErrors: parsed.error.flatten().fieldErrors }

    await contadores.reiniciar(parsed.data.areaId, parsed.data.tipo, parsed.data.glosa, admin.id, parsed.data.force)
    revalidatePath('/contadores')
    return success({ areaId: parsed.data.areaId, tipo: parsed.data.tipo })
  } catch (e) {
    return resultadoError(e)
  }
}