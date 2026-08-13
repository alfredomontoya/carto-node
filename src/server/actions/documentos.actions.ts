'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireModule } from '@/server/auth/dal'
import { repos } from '@/server/repo/drizzle'
import { DocumentoService } from '@/server/services/documento.service'
import { resultadoError, success, type ActionResult } from './helpers'

const docService = new DocumentoService(repos)

const documentoSchema = z.object({
  areaId: z.number().int().positive(),
  tipo: z.enum(['ci', 'of']),
  referencia: z.string().min(3, 'La referencia es obligatoria (mín. 3 caracteres).').trim(),
  descripcion: z.string().optional().nullable(),
  destinatarioUserId: z.number().int().positive().nullable().optional(),
  destinatarioTexto: z.string().trim().optional().nullable(),
  fechaDocumento: z.string().optional().nullable(),
})

export async function crearDocumentoAction(
  input: z.infer<typeof documentoSchema> & { archivos?: File[] },
): Promise<
  ActionResult<{
    id: number
    nroCompleto: string
    numero: number
    year: number
    tipo: 'ci' | 'of'
    referencia: string
    fechaDocumento: string
  }>
> {
  try {
    const actor = await requireModule('documentos')
    const parsed = documentoSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: 'Revisa los datos.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    if (!parsed.data.destinatarioUserId && !parsed.data.destinatarioTexto) {
      return { ok: false, error: 'Indica el destino: un usuario interno o un texto.', fieldErrors: { destinatario: ['Selecciona un usuario o escribe el destino.'] } }
    }
    if ((input.archivos?.length ?? 0) > 10) {
      return { ok: false, error: 'Máximo 10 archivos adjuntos.' }
    }

    const archivos = []
    for (const file of input.archivos ?? []) {
      const data = new Uint8Array(await file.arrayBuffer())
      archivos.push({ name: file.name, mime: file.type, size: file.size, data })
    }

    const documento = await docService.crear(
      {
        areaId: parsed.data.areaId,
        tipo: parsed.data.tipo,
        referencia: parsed.data.referencia,
        descripcion: parsed.data.descripcion,
        destinatarioUserId: parsed.data.destinatarioUserId ?? null,
        destinatarioTexto: parsed.data.destinatarioTexto || null,
        fechaDocumento: parsed.data.fechaDocumento ? new Date(parsed.data.fechaDocumento) : undefined,
        archivos,
      },
      { id: actor.id, role: actor.role, areaId: actor.asignacionActiva?.areaId ?? null },
    )

    revalidatePath('/documentos')
    revalidatePath('/dashboard')

    return success({
      id: documento.id,
      nroCompleto: documento.nroCompleto,
      numero: documento.numero,
      year: documento.year,
      tipo: documento.tipo,
      referencia: documento.referencia,
      fechaDocumento: documento.fechaDocumento.toISOString(),
    })
  } catch (e) {
    return resultadoError(e)
  }
}

const editarSchema = z.object({
  referencia: z.string().min(3).trim(),
  descripcion: z.string().optional().nullable(),
  destinatarioUserId: z.number().int().positive().nullable().optional(),
  destinatarioTexto: z.string().trim().optional().nullable(),
})

export async function actualizarDocumentoAction(
  id: number,
  input: z.infer<typeof editarSchema>,
): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await requireModule('documentos')
    const parsed = editarSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'Revisa los datos.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    await docService.actualizar(
      id,
      { id: actor.id, role: actor.role, areaId: actor.asignacionActiva?.areaId ?? null },
      parsed.data,
    )
    revalidatePath(`/documentos/${id}`)
    revalidatePath('/documentos')
    return success({ id })
  } catch (e) {
    return resultadoError(e)
  }
}

export async function eliminarDocumentoAction(id: number): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await requireModule('documentos')
    await docService.eliminar(id, { id: actor.id, role: actor.role, areaId: actor.asignacionActiva?.areaId ?? null })
    revalidatePath('/documentos')
    return success({ id })
  } catch (e) {
    return resultadoError(e)
  }
}