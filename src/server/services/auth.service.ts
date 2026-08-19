import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { SesionUsuario } from '@/server/domain/constants'
import { esTemaValido } from '@/server/domain/constants'
import { AppError, notFound } from '@/server/domain/errors'
import { DOMINIO_CORREO } from '@/server/domain/identidad'
import type { Repos } from '@/server/repo/interface'

export interface LoginResultado {
  token: string
  usuario: SesionUsuario
}

const MAX_INTENTOS = 5
const VENTANA_SEGUNDOS = 15 * 60

export class AuthService {
  constructor(private readonly repos: Repos) {}

  async login(identificador: string, password: string, ip: string): Promise<LoginResultado> {
    const ident = identificador.toLowerCase().trim()
    const email = ident.includes('@') ? ident : `${ident}@${DOMINIO_CORREO}`

    const recientes = await this.repos.audit.countRecentAttempts(email, ip, VENTANA_SEGUNDOS)
    if (recientes >= MAX_INTENTOS) {
      throw new AppError('Demasiados intentos. Intenta nuevamente en unos minutos.', 'AUTH', 429)
    }

    const usuario = await this.repos.users.findByEmail(email)
    const valido = usuario && (await bcrypt.compare(password, usuario.passwordHash))

    if (!usuario || !valido) {
      await this.repos.audit.recordAttempt({ email, ip, success: false })
      throw new AppError('Credenciales incorrectas.', 'AUTH', 401)
    }

    if (!usuario.active) {
      await this.repos.audit.recordAttempt({ email, ip, success: false })
      throw new AppError('Tu cuenta está desactivada. Contacta al administrador.', 'AUTH', 403)
    }

    await this.repos.audit.recordAttempt({ email, ip, success: true })

    const token = randomBytes(48).toString('hex')
    const ttlDias = Number(process.env.SESSION_TTL_DAYS ?? 7)
    await this.repos.sessions.create({
      id: token,
      userId: usuario.id,
      expiresAt: new Date(Date.now() + ttlDias * 24 * 60 * 60 * 1000),
    })

    return { token, usuario: await this.cargarSesion(usuario.id) }
  }

  async cerrarSesion(token: string): Promise<void> {
    if (token) await this.repos.sessions.deleteById(token)
  }

  async verificarToken(token: string | undefined, now = new Date()): Promise<SesionUsuario | null> {
    if (!token) return null
    const session = await this.repos.sessions.findById(token)
    if (!session) return null

    await this.repos.sessions.touch(token, now)
    return this.cargarSesion(session.userId)
  }

  async cargarSesion(userId: string): Promise<SesionUsuario> {
    const usuario = await this.repos.users.findByIdentifier(userId)
    if (!usuario) throw notFound('Usuario no encontrado.')

    const asignacion = await this.repos.users.activeUserAreaWithDetails(userId)
    return {
      id: usuario.id,
      name: usuario.name,
      email: usuario.email,
      role: usuario.role,
      active: usuario.active,
      theme: esTemaValido(usuario.theme) ? usuario.theme : 'carto-dark',
      modules: usuario.role === 'admin' ? ['areas', 'documentos', 'contadores', 'usuarios'] : usuario.moduleAssignments.map((a) => a.module),
      asignacionActiva: asignacion
        ? {
            userAreaId: asignacion.userAreaId,
            areaId: asignacion.areaId ?? '',
            areaName: asignacion.areaName ?? '',
            areaSigla: asignacion.areaSigla ?? '',
            puestoId: asignacion.puestoId,
            puestoName: asignacion.puestoName,
            areaEstado: asignacion.areaActive ? 'activo' : 'inactivo',
          }
        : null,
    }
  }
}