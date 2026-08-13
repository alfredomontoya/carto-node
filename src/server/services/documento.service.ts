import type { Documento } from '@/db/schema'
import type { TipoDocumento } from '@/server/domain/constants'
import { ETIQUETA_TIPO } from '@/server/domain/constants'
import { conflict, forbidden, notFound } from '@/server/domain/errors'
import type { Repos } from '@/server/repo/interface'
import { ContadorService } from '@/server/services/contador.service'
import type { ArchivoVirtual } from '@/server/services/storage.service'
import { obtenerStorage } from '@/server/services/storage.service'

export interface CreaDocumentoInput {
  areaId: number
  tipo: TipoDocumento
  referencia: string
  descripcion?: string | null
  destinatarioUserId?: number | null
  destinatarioTexto?: string | null
  fechaDocumento?: Date
  archivos?: ArchivoVirtual[]
}

export interface Actor {
  id: number
  role: 'admin' | 'user' | 'guest'
  areaId: number | null
}

export class DocumentoService {
  private readonly contadores: ContadorService

  constructor(private readonly repos: Repos) {
    this.contadores = new ContadorService(repos)
  }

  async crear(input: CreaDocumentoInput, actor: Actor): Promise<Documento> {
    this.autorizarCreacion(input, actor)

    const area = await this.repos.areas.findById(input.areaId)
    if (!area) throw notFound('El área no existe.')

    if (!input.referencia.trim()) throw conflict('La referencia es obligatoria.')
    if (!input.destinatarioUserId && !input.destinatarioTexto?.trim()) {
      throw conflict('Debes indicar el destino: un usuario de la base o un texto.')
    }

    const asignado = await this.contadores.siguienteNumero(input.areaId, input.tipo)

    const documento = await this.repos.documentos.create({
      areaId: input.areaId,
      contadorId: asignado.contadorId,
      tipo: input.tipo,
      year: asignado.year,
      ciclo: asignado.ciclo,
      numero: asignado.numero,
      nroCompleto: asignado.nroCompleto,
      referencia: input.referencia.trim(),
      descripcion: input.descripcion?.trim() || null,
      destinatarioUserId: input.destinatarioUserId ?? null,
      destinatarioTexto: input.destinatarioTexto?.trim() || null,
      fechaDocumento: input.fechaDocumento ?? new Date(),
      creadoPor: actor.id,
    })

    if (input.archivos && input.archivos.length > 0) {
      const storage = obtenerStorage()
      for (const archivo of input.archivos) {
        const guardado = await storage.guardar(archivo)
        await this.repos.files.create({
          documentoId: documento.id,
          nombreOriginal: archivo.name,
          mime: archivo.mime,
          size: guardado.size,
          path: guardado.path,
        })
      }
    }

    return documento
  }

  private autorizarCreacion(input: CreaDocumentoInput, actor: Actor): void {
    if (actor.role === 'guest') throw forbidden('Los invitados solo pueden consultar.')
    if (actor.role === 'admin') return
    if (actor.areaId == null) throw forbidden('No tienes un área activa asignada para emitir documentos.')
    if (actor.areaId !== input.areaId) {
      throw forbidden('Solo puedes emitir documentos para tu área activa.')
    }
  }

  async listar(
    actor: Actor,
    filtros: {
      q?: string
      areaId?: number
      tipo?: TipoDocumento | ''
      year?: number | ''
      estado?: 'activo' | 'anulado' | 'todos'
      soloMios?: boolean
      page: number
      perPage: number
    },
  ): Promise<ReturnType<Repos['documentos']['list']>> {
    return this.repos.documentos.list({
      q: filtros.q || undefined,
      areaId: filtros.areaId || undefined,
      tipo: filtros.tipo || undefined,
      year: filtros.year ? Number(filtros.year) : undefined,
      estado: filtros.estado,
      soloMios: filtros.soloMios,
      userId: actor.id,
      page: filtros.page,
      perPage: filtros.perPage,
    })
  }

  async obtener(id: number): Promise<NonNullable<Awaited<ReturnType<Repos['documentos']['findByIdWithDetails']>>>> {
    const data = await this.repos.documentos.findByIdWithDetails(id)
    if (!data) throw notFound('El documento no existe.')
    return data
  }

  private async obtenerAutorizado(id: number, actor: Actor): Promise<Documento> {
    const doc = await this.repos.documentos.findById(id)
    if (!doc) throw notFound('El documento no existe.')
    if (doc.estado === 'anulado') {
      throw conflict('El documento ya fue anulado y no puede modificarse.')
    }
    if (actor.role !== 'admin' && doc.creadoPor !== actor.id) {
      throw forbidden('Solo el usuario que creó el documento puede modificarlo.')
    }
    return doc
  }

  async actualizar(
    id: number,
    actor: Actor,
    datos: { referencia: string; descripcion?: string | null; destinatarioUserId?: number | null; destinatarioTexto?: string | null },
  ): Promise<Documento> {
    const doc = await this.obtenerAutorizado(id, actor)
    if (!datos.referencia.trim()) throw conflict('La referencia es obligatoria.')

    return this.repos.documentos.update(doc.id, {
      referencia: datos.referencia.trim(),
      descripcion: datos.descripcion?.trim() || null,
      destinatarioUserId: datos.destinatarioUserId ?? null,
      destinatarioTexto: datos.destinatarioTexto?.trim() || null,
    })
  }

  /** Anula el documento: pasa a estado `anulado` (consultable en histórico) y su número no se reutiliza. */
  async anular(id: number, actor: Actor): Promise<void> {
    await this.obtenerAutorizado(id, actor)
    await this.repos.documentos.anular(id)
  }

  async crearArchivo(id: number, actor: Actor, archivo: ArchivoVirtual): Promise<void> {
    await this.obtenerAutorizado(id, actor)
    const storage = obtenerStorage()
    const guardado = await storage.guardar(archivo)
    await this.repos.files.create({
      documentoId: id,
      nombreOriginal: archivo.name,
      mime: archivo.mime,
      size: guardado.size,
      path: guardado.path,
    })
  }

  async eliminarArchivo(documentoId: number, fileId: number, actor: Actor): Promise<void> {
    await this.obtenerAutorizado(documentoId, actor)
    const file = await this.repos.files.findById(fileId)
    if (!file || file.documentoId !== documentoId) throw notFound('El archivo no existe.')
    await this.repos.files.delete(fileId)
    await obtenerStorage().eliminar(file.path)
  }

  async resumenActor(actor: Actor) {
    const mios = await this.repos.documentos.list({ soloMios: true, userId: actor.id, page: 1, perPage: 1 })
    const ci = await this.contadores.obtenerContador(actor.areaId ?? 0, 'ci').catch(() => null)
    const of = await this.contadores.obtenerContador(actor.areaId ?? 0, 'of').catch(() => null)
    return {
      misDocumentos: mios.total,
      contadorCi: ci,
      contadorOf: of,
      tipoLabel: ETIQUETA_TIPO,
    }
  }
}