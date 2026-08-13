import type { Area, Contador } from '@/db/schema'
import type { TipoDocumento } from '@/server/domain/constants'
import { conflict, notFound } from '@/server/domain/errors'
import type { Repos } from '@/server/repo/interface'

export interface NumeroAsignado {
  numero: number
  year: number
  ciclo: number
  contadorId: number
  areaOwnerId: number
  sigla: string
  nroCompleto: string
}

export class ContadorService {
  constructor(private readonly repos: Repos) {}

  /** Resuelve el área "dueña" de la secuencia.
   *  Sube por la cadena de padres mientras el área tenga numeracionMode = 'hereda'. */
  async resolveAreaOwner(areaId: number): Promise<Area> {
    const byId = new Map<number, Area>()
    for (const a of await this.repos.areas.listAll()) byId.set(a.id, a)

    let current = byId.get(areaId)
    if (!current) throw notFound('El área no existe.')

    let guard = 0
    while (current.numeracionMode === 'hereda' && current.parentId != null && guard < 64) {
      const parent = byId.get(current.parentId)
      if (!parent || parent.id === current.id) break
      current = parent
      guard++
    }
    return current
  }

  private yearFor(owner: Area): number | null {
    return owner.reiniciaAnualmente ? new Date().getFullYear() : null
  }

  private async getContador(owner: Area, tipo: TipoDocumento): Promise<Contador> {
    const year = this.yearFor(owner)
    const found = await this.repos.contadores.findByKey(owner.id, tipo, year)
    if (found) return found
    return this.repos.contadores.create(owner.id, tipo, year)
  }

  async obtenerContador(areaId: number, tipo: TipoDocumento): Promise<Contador> {
    const owner = await this.resolveAreaOwner(areaId)
    return this.getContador(owner, tipo)
  }

  /** Devuelve el siguiente número atómicamente (transacción + incremento).
   *  El número se comparte con el dueño de la secuencia (área de numeración propia),
   *  pero la sigla usada en el formato es la del área emisora. */
  async siguienteNumero(emisorAreaId: number, tipo: TipoDocumento): Promise<NumeroAsignado> {
    const [emisor, owner] = await Promise.all([
      this.repos.areas.findById(emisorAreaId),
      this.resolveAreaOwner(emisorAreaId),
    ])
    if (!emisor) throw notFound('El área no existe.')
    const contador = await this.getContador(owner, tipo)
    const numero = await this.repos.contadores.incrementUltimoNumero(contador.id)
    const year = new Date().getFullYear()
    const nroCompleto = `${tipo}.${owner.sigla.toLowerCase()}.${String(numero).padStart(4, '0')}/${year}`

    return {
      numero,
      year,
      ciclo: contador.ciclo,
      contadorId: contador.id,
      areaOwnerId: owner.id,
      sigla: owner.sigla,
      nroCompleto,
    }
  }

  /** Reinicio manual por el administrador: vuelve a 0 (siguiendo números nuevos en un ciclo distinto) + auditoría.
   *  Por defecto queda bloqueado si el año actual ya emitió números para el área dueña
   *  (o para áreas que numeran como ella); con `force` se reinicia igual conservando los documentos. */
  async reiniciar(
    areaId: number,
    tipo: TipoDocumento,
    glosa: string,
    realizadoPor: number,
    force = false,
  ): Promise<Contador> {
    if (!glosa || glosa.trim().length < 3) {
      throw conflict('Debes indicar una glosa (motivo del reinicio) de al menos 3 caracteres.')
    }
    const owner = await this.resolveAreaOwner(areaId)
    const contador = await this.getContador(owner, tipo)
    const year = new Date().getFullYear()

    const emitidos = await this.repos.documentos.countIssuedForYear(contador.id, year)
    if (emitidos > 0 && !force) {
      throw conflict(
        `El año ${year} ya emitió ${emitidos} número(s) para este correlativo. Usa "reiniciar de todos modos" si deseas forzarlo.`,
      )
    }

    const anterior = contador.ultimoNumero

    const nuevo = await this.repos.contadores.reiniciar(contador.id, glosa.trim())
    await this.repos.audit.createReset({
      contadorId: contador.id,
      realizadoPor,
      glosa: glosa.trim(),
      numeroAnterior: anterior,
      numeroNuevo: 0,
    })
    return nuevo
  }

  async estado(areaId: number, tipo: TipoDocumento): Promise<{ contador: Contador; areaOwner: Area; tipo: TipoDocumento }> {
    const owner = await this.resolveAreaOwner(areaId)
    const contador = await this.getContador(owner, tipo)
    return { contador, areaOwner: owner, tipo }
  }

  /** Estados de todos los contadores por área (módulo admin). */
  async listaEstados(): Promise<Array<{ area: Area; ci: Contador | null; of: Contador | null }>> {
    const owners = new Map<number, Area>()
    for (const area of await this.repos.areas.listAll()) {
      const owner = await this.resolveAreaOwner(area.id)
      owners.set(owner.id, owner)
    }

    const out: Array<{ area: Area; ci: Contador | null; of: Contador | null }> = []
    for (const owner of owners.values()) {
      const year = owner.reiniciaAnualmente ? new Date().getFullYear() : null
      const ci = await this.repos.contadores.findByKey(owner.id, 'ci', year)
      const of = await this.repos.contadores.findByKey(owner.id, 'of', year)
      out.push({ area: owner, ci, of })
    }
    return out.sort((a, b) => a.area.name.localeCompare(b.area.name))
  }

  validateTipo(tipo: string): TipoDocumento {
    if (tipo !== 'ci' && tipo !== 'of') throw conflict('Tipo de documento inválido.')
    return tipo
  }
}