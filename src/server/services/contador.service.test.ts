import { describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'
import { createTestDb, limpiarTablas } from '@/db/test-db'

const tdb = createTestDb()
tdb.setEnv()

const { repos } = await import('@/server/repo')
const { ContadorService } = await import('@/server/services/contador.service')

const contadores = new ContadorService(repos)

async function crearArea(nombre: string, sigla: string, parentId: string | null, modo: 'propia' | 'hereda') {
  return repos.areas.create({ name: nombre, sigla, parentId, numeracionMode: modo, reiniciaAnualmente: true, active: true })
}

async function crearAdmin() {
  return repos.users.create({ name: 'Admin', email: 'admin@test.bo', passwordHash: bcrypt.hashSync('x', 4), role: 'admin', active: true })
}

beforeEach(async () => {
  await limpiarTablas()
})

afterAll(() => tdb.cleanup())

describe('ContadorService', () => {
  const year = new Date().getFullYear()

  it('resuelve el dueño de la secuencia subiendo por la cadena "hereda"', async () => {
    const a = await crearArea('A', 'A', null, 'propia')
    const b = await crearArea('B', 'B', a.id, 'hereda')
    const c = await crearArea('C', 'C', b.id, 'hereda')

    expect((await contadores.resolveAreaOwner(c.id)).id).toBe(a.id)
    expect((await contadores.resolveAreaOwner(b.id)).id).toBe(a.id)
    expect((await contadores.resolveAreaOwner(a.id)).id).toBe(a.id)
  })

  it('comparte el contador del dueño y usa su sigla en el formato', async () => {
    const a = await crearArea('A', 'A', null, 'propia')
    const b = await crearArea('B', 'B', a.id, 'hereda')
    const c = await crearArea('C', 'C', b.id, 'hereda')

    const n1 = await contadores.siguienteNumero(b.id, 'ci')
    const n2 = await contadores.siguienteNumero(c.id, 'ci')

    expect(n1.nroCompleto).toBe(`ci.a.0001/${year}`)
    expect(n2.nroCompleto).toBe(`ci.a.0002/${year}`)
    expect(n1.areaOwnerId).toBe(a.id)
    expect(n2.areaOwnerId).toBe(a.id)
    expect(n2.numero).toBe(n1.numero + 1)
    expect(n1.contadorId).toBe(n2.contadorId)
  })

  it('las áreas con numeración propia tienen contadores separados', async () => {
    const a = await crearArea('A', 'A', null, 'propia')
    const b = await crearArea('B', 'B', a.id, 'propia')

    const n1 = await contadores.siguienteNumero(a.id, 'of')
    const n2 = await contadores.siguienteNumero(b.id, 'of')

    expect(n1.nroCompleto).toBe(`of.a.0001/${year}`)
    expect(n2.nroCompleto).toBe(`of.b.0001/${year}`)
    expect(n1.contadorId).not.toBe(n2.contadorId)
  })

  it('bloquea el reinicio si el año ya emitió números y lo permite con force', async () => {
    const admin = await crearAdmin()
    const a = await crearArea('A', 'A', null, 'propia')

    await emitir(a.id, 'ci', admin.id)
    await emitir(a.id, 'ci', admin.id)

    await expect(contadores.reiniciar(a.id, 'ci', 'Cierre de gestión', admin.id)).rejects.toThrow(/ya emitió/i)

    const reiniciado = await contadores.reiniciar(a.id, 'ci', 'Cierre de gestión', admin.id, true)
    expect(reiniciado.ciclo).toBe(2)
    expect(reiniciado.ultimoNumero).toBe(0)

    const owner = await contadores.resolveAreaOwner(a.id)
    const contador = await repoContadorDe(owner.id, 'ci')
    const resets = await repos.audit.resetsByContador(contador.id)
    expect(resets).toHaveLength(1)
    expect(resets[0].glosa).toBe('Cierre de gestión')
    expect(resets[0].numeroAnterior).toBe(2)
    expect(resets[0].numeroNuevo).toBe(0)
    expect(resets[0].realizadoPor).toBe(admin.id)

    // tras el reinicio sigue numerando en el nuevo ciclo sin reutilizar el 001
    const n = await contadores.siguienteNumero(a.id, 'ci')
    expect(n.ciclo).toBe(2)
    expect(n.numero).toBe(1)
    expect(n.nroCompleto).toBe(`ci.a.0001/${year}`)
  })

  it('permite reiniciar sin conflicto cuando el año no emitió números', async () => {
    const admin = await crearAdmin()
    const a = await crearArea('A', 'A', null, 'propia')

    const reiniciado = await contadores.reiniciar(a.id, 'ci', 'Reinicio preventivo', admin.id)
    expect(reiniciado.ciclo).toBe(2)
    expect(reiniciado.ultimoNumero).toBe(0)
  })

  it('exige una glosa al reiniciar', async () => {
    const admin = await crearAdmin()
    const a = await crearArea('A', 'A', null, 'propia')
    await expect(contadores.reiniciar(a.id, 'ci', '', admin.id)).rejects.toThrow(/glosa/i)
    await expect(contadores.reiniciar(a.id, 'ci', 'ab', admin.id)).rejects.toThrow(/glosa/i)
  })
})

async function repoContadorDe(areaOwnerId: string, tipo: 'ci' | 'of') {
  const contador = await repos.contadores.findByKey(areaOwnerId, tipo, new Date().getFullYear())
  if (!contador) throw new Error('Contador no encontrado')
  return contador
}

/** Emite un número "de verdad": asigna el correlativo y crea el documento. */
async function emitir(areaId: string, tipo: 'ci' | 'of', creadoPor: string) {
  const n = await contadores.siguienteNumero(areaId, tipo)
  await repos.documentos.create({
    areaId,
    contadorId: n.contadorId,
    tipo,
    year: n.year,
    ciclo: n.ciclo,
    numero: n.numero,
    nroCompleto: n.nroCompleto,
    referencia: 'Emitido',
    destinatarioTexto: 'Dest',
    fechaDocumento: new Date(),
    creadoPor,
  })
  return n
}