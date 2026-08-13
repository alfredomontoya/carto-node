import type { Area, Puesto } from '@/db/schema'
import type { Modulo } from '@/server/domain/constants'
import { conflict, forbidden, notFound } from '@/server/domain/errors'
import type { Repos } from '@/server/repo/interface'

export interface NodoArea extends Area {
  puestos: Puesto[]
  heredasDe: { id: number; name: string; sigla: string } | null
  hijos: NodoArea[]
}

export interface DatosArea {
  name: string
  sigla: string
  description?: string | null
  active?: boolean
  parentId?: number | null
  numeracionMode: 'propia' | 'hereda'
  reiniciaAnualmente: boolean
}

export class AreaService {
  constructor(private readonly repos: Repos) {}

  async crear(datos: DatosArea): Promise<Area> {
    if (datos.numeracionMode === 'hereda' && !datos.parentId) {
      throw conflict('Un área que hereda numeración debe tener un área padre.')
    }
    if (datos.parentId) {
      const parent = await this.repos.areas.findById(datos.parentId)
      if (!parent) throw notFound('El área padre no existe.')
      if (parent.numeracionMode === 'hereda' && datos.numeracionMode === 'hereda') {
        // heredar de una que también hereda es válido: se resuelve al dueño real.
      }
      if (parent.parentId === datos.parentId) {
        throw conflict('El área seleccionada no puede ser su propio padre.')
      }
    }
    const area = await this.repos.areas.create({
      name: datos.name,
      sigla: datos.sigla.toUpperCase(),
      description: datos.description ?? null,
      active: datos.active ?? true,
      parentId: datos.parentId ?? null,
      numeracionMode: datos.numeracionMode,
      reiniciaAnualmente: datos.reiniciaAnualmente,
    })

    for (const puesto of ['JEFE', 'TECNICO', 'ABOGADO', 'SECRETARIA', 'ASISTENTE']) {
      await this.repos.areas.createPuesto(area.id, { name: puesto, sigla: puesto.slice(0, 3) })
    }
    return area
  }

  async actualizar(id: number, datos: Partial<DatosArea>): Promise<Area> {
    const actual = await this.repos.areas.findById(id)
    if (!actual) throw notFound('El área no existe.')

    if (datos.parentId != null && datos.parentId === id) {
      throw conflict('Un área no puede ser su propio padre.')
    }
    if (datos.parentId != null) {
      const parent = await this.repos.areas.findById(datos.parentId)
      if (!parent) throw notFound('El área padre no existe.')
      const ancestors = await this.ancestors(parent.id)
      if (ancestors.some((a) => a.id === id)) {
        throw conflict('No puedes asignar un descendiente como padre (crearía un ciclo).')
      }
    }

    return this.repos.areas.update(id, {
      name: datos.name,
      sigla: datos.sigla?.toUpperCase(),
      description: datos.description,
      active: datos.active,
      parentId: datos.parentId,
      numeracionMode: datos.numeracionMode,
      reiniciaAnualmente: datos.reiniciaAnualmente,
    })
  }

  private async ancestors(areaId: number): Promise<Area[]> {
    const all = await this.repos.areas.listAll()
    const byId = new Map(all.map((a) => [a.id, a]))
    const out: Area[] = []
    let current = byId.get(areaId)
    let guard = 0
    while (current && guard < 64) {
      if (current.parentId == null) break
      const parent = byId.get(current.parentId)
      if (!parent) break
      out.push(parent)
      current = parent
      guard++
    }
    return out
  }

  async eliminar(id: number): Promise<void> {
    const area = await this.repos.areas.findById(id)
    if (!area) throw notFound('El área no existe.')

    const hijos = await this.repos.areas.countByParent(id)
    if (hijos > 0) throw conflict('No se puede eliminar un área que tiene áreas hijas.')

    const usuarios = await this.repos.areas.countUsersInArea(id)
    if (usuarios > 0) throw conflict('No se puede eliminar un área con usuarios asignados.')

    const puestos = await this.repos.areas.puestosByArea(id)
    if (puestos.length > 0) throw conflict('No se puede eliminar un área con puestos asignados.')

    const documentos = await this.repos.documentos.countByArea(id)
    if (documentos > 0) throw conflict('No se puede eliminar un área con documentos emitidos.')

    await this.repos.areas.delete(id)
  }

  async obtenerArbol(): Promise<NodoArea[]> {
    const areas = await this.repos.areas.listAll()
    const puestos = await Promise.all(areas.map((a) => this.repos.areas.puestosByArea(a.id)))
    const puestosPorArea = new Map<number, Puesto[]>()
    for (const p of puestos.flat()) {
      const list = puestosPorArea.get(p.areaId) ?? []
      list.push(p)
      puestosPorArea.set(p.areaId, list)
    }

    const byId = new Map<number, NodoArea>()
    for (const a of areas) {
      byId.set(a.id, {
        ...a,
        puestos: puestosPorArea.get(a.id) ?? [],
        heredasDe: null,
        hijos: [],
      })
    }
    for (const a of byId.values()) {
      if (a.parentId != null && a.parentId !== a.id) {
        const parent = byId.get(a.parentId)
        if (parent) {
          parent.hijos.push(a)
          if (a.numeracionMode === 'hereda') {
            a.heredasDe = { id: parent.id, name: parent.name, sigla: parent.sigla }
          }
        }
      }
    }
    const roots = [...byId.values()].filter((a) => a.parentId == null)
    return roots.map((r) => this.sortTree(r))
  }

  private sortTree(nodo: NodoArea): NodoArea {
    nodo.hijos = nodo.hijos.map((h) => this.sortTree(h)).sort((a, b) => a.name.localeCompare(b.name))
    return nodo
  }

  async obtener(id: number): Promise<NodoArea | null> {
    const area = await this.repos.areas.findById(id)
    if (!area) return null
    const puestos = await this.repos.areas.puestosByArea(id)
    const heredasDe = area.parentId != null && area.numeracionMode === 'hereda' ? await this.repos.areas.findById(area.parentId) : null
    return {
      ...area,
      puestos,
      heredasDe: heredasDe ? { id: heredasDe.id, name: heredasDe.name, sigla: heredasDe.sigla } : null,
      hijos: [],
    }
  }

  // ----- puestos -----
  async crearPuesto(areaId: number, datos: { name: string; sigla: string; description?: string }): Promise<Puesto> {
    const area = await this.repos.areas.findById(areaId)
    if (!area) throw notFound('El área no existe.')
    return this.repos.areas.createPuesto(areaId, {
      name: datos.name,
      sigla: datos.sigla.toUpperCase(),
      description: datos.description ?? null,
      active: true,
    })
  }

  async actualizarPuesto(areaId: number, puestoId: number, datos: Partial<{ name: string; sigla: string; description: string | null; active: boolean }>): Promise<Puesto> {
    const puestos = await this.repos.areas.puestosByArea(areaId)
    const puesto = puestos.find((p) => p.id === puestoId)
    if (!puesto) throw notFound('El puesto no pertenece a esta área.')
    return this.repos.areas.updatePuesto(puestoId, {
      ...datos,
      sigla: datos.sigla ? datos.sigla.toUpperCase() : undefined,
    })
  }

  async eliminarPuesto(areaId: number, puestoId: number): Promise<void> {
    const puestos = await this.repos.areas.puestosByArea(areaId)
    if (!puestos.some((p) => p.id === puestoId)) throw notFound('El puesto no pertenece a esta área.')
    await this.repos.areas.deletePuesto(puestoId)
  }
}

export async function requireModuloActor(actor: { role: string; modules: Modulo[] }, modulo: Modulo, esAdminOnly: boolean): Promise<void> {
  if (actor.role === 'admin') return
  if (esAdminOnly) throw forbidden()
  if (!actor.modules.includes(modulo)) throw forbidden(`No tienes el módulo "${modulo}" asignado.`)
}

export async function requireActorSiNoAdmin(actor: { role: string }, esAdminOnly: boolean): Promise<void> {
  if (esAdminOnly && actor.role !== 'admin') throw forbidden()
}