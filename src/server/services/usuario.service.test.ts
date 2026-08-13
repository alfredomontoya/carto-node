import { describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'
import { createTestDb, limpiarTablas } from '@/db/test-db'

const tdb = createTestDb()
tdb.setEnv()

const { repos } = await import('@/server/repo/drizzle')
const { UsuarioService } = await import('@/server/services/usuario.service')
const { AuthService } = await import('@/server/services/auth.service')
const { DocumentoService } = await import('@/server/services/documento.service')

const usuarios = new UsuarioService(repos)
const auth = new AuthService(repos)
const docs = new DocumentoService(repos)

beforeEach(async () => {
  await limpiarTablas()
})

afterAll(() => tdb.cleanup())

describe('UsuarioService', () => {
  it('crea un usuario con contraseña por defecto derivada del correo', async () => {
    await usuarios.crear({ name: 'Juan Pérez', email: 'juan@seguimiento.bo', role: 'user', modules: ['documentos'] })
    const creado = await repos.users.findByEmail('juan@seguimiento.bo')
    expect(creado).not.toBeNull()
    expect(creado!.role).toBe('user')
    // inicio de sesión con la password por defecto: nombre@dominio.123
    const { token } = await auth.login('juan@seguimiento.bo', 'juanseguimiento.bo.123', 'ip-test')
    expect(token).toBeTruthy()
  })

  it('normaliza los módulos: no permite módulos admin-only en usuarios', async () => {
    await usuarios.crear({ name: 'X', email: 'x@seg.bo', role: 'user', modules: ['areas', 'contadores', 'usuarios'] })
    const u = await repos.users.findByIdentifier('x@seg.bo')
    const mods = u!.moduleAssignments.map((m) => m.module)
    expect(mods).toContain('areas')
    expect(mods).not.toContain('contadores')
    expect(mods).not.toContain('usuarios')
  })

  it('rechaza el correo duplicado', async () => {
    await usuarios.crear({ name: 'A', email: 'a@seg.bo', role: 'user', modules: [] })
    await expect(usuarios.crear({ name: 'B', email: 'a@seg.bo', role: 'user', modules: [] })).rejects.toThrow(/existe/)
  })

  it('no permite eliminar al último administrador activo', async () => {
    const admin = await repos.users.create({ name: 'Admin', email: 'admin@seg.bo', passwordHash: 'x', role: 'admin', active: true })
    await expect(usuarios.eliminar(admin.id, admin.id + 99)).rejects.toThrow(/administrador/)
    await expect(usuarios.actualizar(admin.id, { role: 'user' })).rejects.toThrow(/administrador/)
  })

  it('no permite eliminar a un usuario que creó documentos', async () => {
    const admin = await repos.users.create({ name: 'Admin', email: 'admin@seg.bo', passwordHash: 'x', role: 'admin', active: true })
    const emisor = await repos.users.create({ name: 'Emisor', email: 'emisor@seg.bo', passwordHash: 'x', role: 'user', active: true })
    const area = await repos.areas.create({ name: 'A', sigla: 'A', numeracionMode: 'propia', reiniciaAnualmente: true, active: true })
    await docs.crear({ areaId: area.id, tipo: 'ci', referencia: 'Remisión', destinatarioTexto: 'D' }, { id: emisor.id, role: 'user', areaId: area.id })

    await expect(usuarios.eliminar(emisor.id, admin.id)).rejects.toThrow(/documentos/)
  })

  it('resetPassword invalida las sesiones del usuario', async () => {
    const u = await repos.users.create({ name: 'U', email: 'u@seg.bo', passwordHash: bcrypt.hashSync('x', 4), role: 'user', active: true })
    const s1 = await auth.login('u@seg.bo', 'x', 'ip')
    await usuarios.resetPassword(u.id, 'nueva-segura')

    await expect(auth.verificarToken(s1.token)).resolves.toBeNull()
  })
})

describe('AuthService', () => {
  it('limita los intentos fallidos de acceso', async () => {
    await repos.users.create({ name: 'U', email: 'u@seg.bo', passwordHash: 'x', role: 'user', active: true })

    for (let i = 0; i < 5; i++) {
      await auth.login('u@seg.bo', 'incorrecta', 'ip-1').catch(() => null)
    }
    await expect(auth.login('u@seg.bo', 'x', 'ip-1')).rejects.toThrow(/intento/i)
  })
})