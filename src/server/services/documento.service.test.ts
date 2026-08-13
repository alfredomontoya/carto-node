import { describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'
import { createTestDb, limpiarTablas } from '@/db/test-db'

const tdb = createTestDb()
tdb.setEnv()

const { repos } = await import('@/server/repo/drizzle')
const { DocumentoService } = await import('@/server/services/documento.service')

const docs = new DocumentoService(repos)

async function crearArea(nombre: string, sigla: string, parentId: number | null = null) {
  return repos.areas.create({ name: nombre, sigla, parentId, numeracionMode: 'propia', reiniciaAnualmente: true, active: true })
}

async function crearUser(email: string, role: 'admin' | 'user' | 'guest' = 'user') {
  return repos.users.create({ name: email.split('@')[0], email, passwordHash: bcrypt.hashSync('x', 4), role, active: true })
}

function actor(id: number, role: 'admin' | 'user' | 'guest', areaId: number | null) {
  return { id, role, areaId }
}

beforeEach(async () => {
  await limpiarTablas()
})

afterAll(() => tdb.cleanup())

describe('DocumentoService.crear', () => {
  it('guarda el documento con número asignado y N° completo', async () => {
    const admin = await crearUser('admin@x.com', 'admin')
    const area = await crearArea('Planeamiento', 'PLAN')

    const doc = await docs.crear(
      { areaId: area.id, tipo: 'ci', referencia: 'Remisión de planos', destinatarioTexto: 'Dirección General' },
      actor(admin.id, 'admin', null),
    )

    expect(doc.nroCompleto).toBe(`PLAN-CI-001/${new Date().getFullYear()}`)
    expect(doc.numero).toBe(1)
    expect(doc.creadoPor).toBe(admin.id)

    const segundo = await docs.crear(
      { areaId: area.id, tipo: 'ci', referencia: 'Segunda remisión', destinatarioUserId: admin.id },
      actor(admin.id, 'admin', null),
    )
    expect(segundo.numero).toBe(2)
    expect(segundo.nroCompleto).not.toBe(doc.nroCompleto)
  })

  it('los invitados no pueden crear documentos', async () => {
    const guest = await crearUser('guest@x.com', 'guest')
    const area = await crearArea('A', 'A')
    await expect(
      docs.crear({ areaId: area.id, tipo: 'ci', referencia: 'X y y', destinatarioTexto: 'D' }, actor(guest.id, 'guest', area.id)),
    ).rejects.toThrow(/invitado/i)
  })

  it('un usuario sin área activa no puede emitir', async () => {
    const u = await crearUser('u@x.com')
    const area = await crearArea('A', 'A')
    await expect(
      docs.crear({ areaId: area.id, tipo: 'ci', referencia: 'X y y', destinatarioTexto: 'D' }, actor(u.id, 'user', null)),
    ).rejects.toThrow(/área/)
  })

  it('un usuario solo puede emitir para su área activa', async () => {
    const u = await crearUser('u@x.com')
    const propia = await crearArea('Mia', 'MIA')
    const otra = await crearArea('Otra', 'OTRA')
    await repos.users.setActiveAssignment(u.id, propia.id, null)

    const ok = await docs.crear({ areaId: propia.id, tipo: 'of', referencia: 'Informe final', destinatarioTexto: 'Gobierno' }, actor(u.id, 'user', propia.id))
    expect(ok.nroCompleto).toBe(`MIA-OF-001/${new Date().getFullYear()}`)

    await expect(
      docs.crear({ areaId: otra.id, tipo: 'of', referencia: 'Informe final', destinatarioTexto: 'Gobierno' }, actor(u.id, 'user', propia.id)),
    ).rejects.toThrow(/tu área/i)
  })

  it('exige destino y referencia', async () => {
    const admin = await crearUser('admin@x.com', 'admin')
    const area = await crearArea('A', 'A')
    await expect(
      docs.crear({ areaId: area.id, tipo: 'ci', referencia: 'Sin destino' }, actor(admin.id, 'admin', null)),
    ).rejects.toThrow(/destino/i)
    await expect(
      docs.crear({ areaId: area.id, tipo: 'ci', referencia: ' ', destinatarioTexto: 'D' }, actor(admin.id, 'admin', null)),
    ).rejects.toThrow(/referencia/i)
  })
})

describe('DocumentoService.actualizar/eliminar', () => {
  it('solo el creador (o un admin) puede editar o eliminar', async () => {
    const admin = await crearUser('admin@x.com', 'admin')
    const otro = await crearUser('otro@x.com', 'user')
    const tercero = await crearUser('tercero@x.com', 'user')
    const area = await crearArea('A', 'A')

    const doc = await docs.crear({ areaId: area.id, tipo: 'ci', referencia: 'Original', destinatarioTexto: 'D' }, actor(admin.id, 'admin', null))

    await expect(
      docs.actualizar(doc.id, actor(otro.id, 'user', area.id), { referencia: 'Hack' }),
    ).rejects.toThrow(/creó/i)
    await expect(docs.eliminar(doc.id, actor(tercero.id, 'user', area.id))).rejects.toThrow(/creó/i)

    const actualizado = await docs.actualizar(doc.id, actor(otro.id, 'user', area.id), { referencia: 'Original' }).catch(() => null)
    void actualizado

    await docs.actualizar(doc.id, actor(admin.id, 'admin', null), { referencia: 'Editado por admin' })
    const detalle = await docs.obtener(doc.id)
    expect(detalle.documento.referencia).toBe('Editado por admin')

    await docs.eliminar(doc.id, actor(otro.id, 'user', area.id)).catch(() => {})
    const trasAdmin = await repos.documentos.findById(doc.id)
    expect(trasAdmin?.deletedAt).toBeNull()
  })

  it('el creador puede eliminar (soft delete)', async () => {
    const admin = await crearUser('admin@x.com', 'admin')
    const area = await crearArea('A', 'A')
    const doc = await docs.crear({ areaId: area.id, tipo: 'ci', referencia: 'Original', destinatarioTexto: 'D' }, actor(admin.id, 'admin', null))

    await docs.eliminar(doc.id, actor(admin.id, 'admin', null))
    const tras = await repos.documentos.findById(doc.id)
    expect(tras?.deletedAt).toBeInstanceOf(Date)
    await expect(docs.obtener(doc.id)).rejects.toThrow(/no existe/i)
  })
})