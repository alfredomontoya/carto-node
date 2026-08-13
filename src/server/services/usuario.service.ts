import bcrypt from 'bcryptjs'
import type { Modulo } from '@/server/domain/constants'
import type { Rol } from '@/server/domain/constants'
import { conflict, notFound, validationError } from '@/server/domain/errors'
import type { Repos } from '@/server/repo/interface'

export interface DatosUsuario {
  name: string
  email: string
  password?: string
  role: 'admin' | 'user' | 'guest'
  active?: boolean
  modules: string[]
  areaId?: number | null
  puestoId?: number | null
}

export class UsuarioService {
  constructor(private readonly repos: Repos) {}

  async listar(search?: string) {
    const usuarios = await this.repos.users.list(search)
    return Promise.all(
      usuarios.map(async (u) => {
        const asignacion = await this.repos.users.activeUserAreaWithDetails(u.id)
        return { ...u, asignacionActiva: asignacion }
      }),
    )
  }

  async crear(datos: DatosUsuario): Promise<{ id: number }> {
    this.validarDatos(datos)

    const existente = await this.repos.users.findByEmail(datos.email)
    if (existente) throw conflict('Ya existe un usuario con ese correo electrónico.')

    const [nombre, dominio] = datos.email.toLowerCase().split('@')
    const usuario = await this.repos.users.create({
      name: datos.name.trim(),
      email: datos.email.toLowerCase().trim(),
      passwordHash: bcrypt.hashSync(datos.password ?? `${nombre}${dominio}.123`, 12),
      role: datos.role,
      active: datos.active !== false,
    })

    try {
      await this.repos.users.setModules(usuario.id, this.normalizarModulos(datos.role, datos.modules))
      if (datos.areaId) {
        await this.repos.users.setActiveAssignment(usuario.id, datos.areaId, datos.puestoId ?? null)
      }
    } catch (e) {
      await this.repos.users.archive(usuario.id)
      throw e
    }

    return { id: usuario.id }
  }

  async actualizar(id: number, datos: Partial<DatosUsuario>): Promise<void> {
    const usuario = await this.repos.users.findById(id)
    if (!usuario) throw notFound('El usuario no existe.')

    if (datos.email) {
      this.validarDatos({ ...(datos as DatosUsuario), name: datos.name ?? usuario.name, email: datos.email })
      const existente = await this.repos.users.findByEmail(datos.email)
      if (existente && existente.id !== id) throw conflict('Ya existe un usuario con ese correo electrónico.')
    } else {
      this.validarDatos({ ...(datos as DatosUsuario), name: datos.name ?? usuario.name, email: usuario.email })
    }

    if (datos.role && datos.role !== 'admin' && usuario.role === 'admin') {
      const admins = (await this.repos.users.list()).filter((u) => u.role === 'admin' && u.active)
      if (admins.length <= 1) {
        throw conflict('No puedes cambiar el rol del último administrador activo.')
      }
    }

    await this.repos.users.update(id, {
      name: datos.name?.trim(),
      email: datos.email?.toLowerCase().trim(),
      role: datos.role,
      active: datos.active,
    })

    if (datos.modules) {
      await this.repos.users.setModules(id, this.normalizarModulos(datos.role ?? usuario.role, datos.modules))
    }

    if (datos.areaId) {
      await this.repos.users.setActiveAssignment(id, datos.areaId, datos.puestoId ?? null)
    }
  }

  async resetPassword(id: number, nuevaPassword: string): Promise<void> {
    const usuario = await this.repos.users.findById(id)
    if (!usuario) throw notFound('El usuario no existe.')
    if (!nuevaPassword || nuevaPassword.length < 6) {
      throw validationError({ password: ['La contraseña debe tener al menos 6 caracteres.'] })
    }
    await this.repos.users.update(id, { passwordHash: bcrypt.hashSync(nuevaPassword, 12) })
    await this.repos.sessions.deleteByUser(id)
  }

  async eliminar(id: number, actorId: number): Promise<void> {
    if (id === actorId) throw conflict('No puedes eliminar tu propio usuario.')
    const usuario = await this.repos.users.findById(id)
    if (!usuario) throw notFound('El usuario no existe.')
    if (usuario.role === 'admin' && usuario.active) {
      const admins = (await this.repos.users.list()).filter((u) => u.role === 'admin' && u.active)
      if (admins.length <= 1) throw conflict('No puedes eliminar al último administrador activo.')
    }
    await this.repos.users.archive(id)
    await this.repos.sessions.deleteByUser(id)
  }

  async asignarArea(userId: number, areaId: number, puestoId: number | null): Promise<void> {
    const usuario = await this.repos.users.findById(userId)
    if (!usuario) throw notFound('El usuario no existe.')
    await this.repos.users.setActiveAssignment(userId, areaId, puestoId)
  }

  async historial(userId: number) {
    return this.repos.users.userAreaHistory(userId)
  }

  private normalizarModulos(role: Rol, modules: string[]): Modulo[] {
    if (role === 'admin') return [] // el admin tiene acceso total
    return modules.filter((m): m is Modulo => m === 'areas' || m === 'documentos') as Modulo[]
  }

  private validarDatos(datos: DatosUsuario): void {
    const fieldErrors: Record<string, string[]> = {}
    if (!datos.name?.trim()) fieldErrors.name = ['El nombre es obligatorio.']
    if (!datos.email?.trim() || !/\S+@\S+\.\S+/.test(datos.email)) {
      fieldErrors.email = ['Ingresa un correo electrónico válido.']
    }
    if (datos.password && datos.password.length < 6) {
      fieldErrors.password = ['La contraseña debe tener al menos 6 caracteres.']
    }
    if (Object.keys(fieldErrors).length > 0) throw validationError(fieldErrors)
  }
}