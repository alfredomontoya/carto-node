import { describe, expect, it } from 'vitest'
import { createTestDb, limpiarTablas } from '@/db/test-db'

const tdb = createTestDb()
tdb.setEnv()

const { repos } = await import('@/server/repo/drizzle')
const { AreaService } = await import('@/server/services/area.service')

const areas = new AreaService(repos)

async function crearArea(nombre: string, sigla: string, parentId: number | null = null, modo: 'propia' | 'hereda' = 'propia') {
  return repos.areas.create({ name: nombre, sigla, parentId, numeracionMode: modo, reiniciaAnualmente: true, active: true })
}

beforeEach(async () => {
  await limpiarTablas()
})

afterAll(() => tdb.cleanup())

describe('AreaService.eliminar', () => {
  it('bloquea si el área tiene áreas hijas', async () => {
    const a = await crearArea('A', 'A')
    await crearArea('B', 'B', a.id, 'hereda')
    await expect(areas.eliminar(a.id)).rejects.toThrow(/hijas/)
  })

  it('bloquea si el área tiene puestos', async () => {
    const a = await crearArea('A', 'A')
    await repos.areas.createPuesto(a.id, { name: 'JEFE', sigla: 'JEF' })
    await expect(areas.eliminar(a.id)).rejects.toThrow(/puestos/)
  })

  it('bloquea si el área tiene documentos emitidos', async () => {
    const a = await crearArea('A', 'A')
    const admin = await repos.users.create({ name: 'Admin', email: 'admin@x.com', passwordHash: 'x', role: 'admin', active: true })
    const { DocumentoService } = await import('@/server/services/documento.service')
    const docs = new DocumentoService(repos)
    await docs.crear({ areaId: a.id, tipo: 'ci', referencia: 'Remisión', destinatarioTexto: 'D' }, { id: admin.id, role: 'admin', areaId: null })
    await expect(areas.eliminar(a.id)).rejects.toThrow(/documentos/)
  })
})
