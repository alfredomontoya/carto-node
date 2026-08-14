'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth/dal'
import { repos } from '@/server/repo'
import { BackupService } from '@/server/services/backup.service'
import { resultadoError, success, type ActionResult } from './helpers'

const servicio = new BackupService(repos)

const backupConfigSchema = z.object({
  habilitado: z.boolean(),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  retentionDias: z.number().int().min(1).max(365),
})

export async function guardarBackupConfigAction(
  input: z.infer<typeof backupConfigSchema>,
): Promise<ActionResult<void>> {
  try {
    await requireAdmin()
    const parsed = backupConfigSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: 'Revisa los datos.', fieldErrors: parsed.error.flatten().fieldErrors }
    }
    await servicio.guardarConfig(parsed.data)
    revalidatePath('/configuracion')
    return success(undefined)
  } catch (e) {
    return resultadoError(e)
  }
}

export async function hacerBackupNowAction(): Promise<ActionResult<{ archivo: string }>> {
  try {
    await requireAdmin()
    const estado = await servicio.crearBackup()
    if (!estado.ultimoOk || !estado.ultimoArchivo) {
      return { ok: false, error: 'El respaldo no se completó correctamente.' }
    }
    revalidatePath('/configuracion')
    return success({ archivo: estado.ultimoArchivo })
  } catch (e) {
    return resultadoError(e)
  }
}