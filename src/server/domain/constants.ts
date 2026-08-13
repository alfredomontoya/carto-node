import type { ModuleAssignment } from '@/db/schema'

export const ROLES = ['admin', 'user', 'guest'] as const
export type Rol = (typeof ROLES)[number]

export const MODULOS = ['areas', 'documentos', 'contadores', 'usuarios', 'reportes'] as const
export type Modulo = (typeof MODULOS)[number]

export const TIPOS_DOCUMENTO = ['ci', 'of'] as const
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]

export const ETIQUETA_TIPO: Record<TipoDocumento, string> = {
  ci: 'Comunicación Interna',
  of: 'Oficio Externo',
}

export const SIGLA_TIPO: Record<TipoDocumento, string> = {
  ci: 'CI',
  of: 'OF',
}

export const PUESTOS_CATALOGO = [
  'JEFE',
  'TECNICO',
  'ABOGADO',
  'SECRETARIA',
  'ASISTENTE',
] as const

export const MODULO_LABEL: Record<Modulo, string> = {
  areas: 'Áreas y Puestos',
  documentos: 'Documentos',
  contadores: 'Numeración',
  usuarios: 'Usuarios',
  reportes: 'Reportes',
}

export const MODULO_ADMIN_ONLY: Record<Modulo, boolean> = {
  areas: false,
  documentos: false,
  contadores: true,
  usuarios: true,
  reportes: false,
}

export interface AsignacionActiva {
  userAreaId: number
  areaId: number
  areaName: string
  areaSigla: string
  puestoId: number | null
  puestoName: string | null
  areaEstado: 'activo' | 'inactivo'
}

export interface SesionUsuario {
  id: number
  name: string
  email: string
  role: Rol
  active: boolean
  modules: Modulo[]
  asignacionActiva: AsignacionActiva | null
}

export function canModule(usuario: Pick<SesionUsuario, 'role' | 'modules'>, modulo: Modulo): boolean {
  if (usuario.role === 'admin') return true
  return usuario.modules.includes(modulo)
}

export function isModuleAssignableToNonAdmin(modulo: Modulo): boolean {
  return !MODULO_ADMIN_ONLY[modulo]
}

export type ModuleAssignmentRow = ModuleAssignment