import type {
  Area,
  Contador,
  DocumentFile,
  Documento,
  ModuleAssignment,
  NewArea,
  NewDocumento,
  NewPuesto,
  NewUser,
  Puesto,
  Reseteo,
  Session,
  User,
  UserArea,
} from '@/db/schema'
import type { Modulo } from '@/server/domain/constants'

export type UserWithModules = User & { moduleAssignments: ModuleAssignment[] }

export interface UserRepo {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  findByIdentifier(id: string): Promise<UserWithModules | null>
  list(search?: string): Promise<UserWithModules[]>
  create(data: NewUser): Promise<User>
  update(id: string, data: Partial<NewUser>): Promise<User>
  archive(id: string): Promise<User>
  count(): Promise<number>
  setModules(userId: string, modules: Modulo[]): Promise<void>
  activeUserArea(userId: string): Promise<UserArea | null>
  activeUserAreaWithDetails(userId: string): Promise<{
    userAreaId: string
    areaId: string | null
    areaName: string | null
    areaSigla: string | null
    areaActive: boolean | null
    puestoId: string | null
    puestoName: string | null
  } | null>
  createUserArea(data: {
    userId: string
    areaId: string
    puestoId: string | null
    fechaInicio: Date
  }): Promise<UserArea>
  deactivateUserArea(userAreaId: string, fechaFin: Date): Promise<void>
  userAreaHistory(userId: string): Promise<Array<UserArea & { areaName: string | null; puestoName: string | null }>>
  setActiveAssignment(userId: string, areaId: string, puestoId: string | null): Promise<void>
}

export interface AreaRepo {
  listAll(): Promise<Area[]>
  findById(id: string): Promise<Area | null>
  create(data: Partial<NewArea>): Promise<Area>
  update(id: string, data: Partial<NewArea>): Promise<Area>
  delete(id: string): Promise<void>
  countByParent(parentId: string): Promise<number>
  countUsersInArea(areaId: string): Promise<number>
  puestosByArea(areaId: string): Promise<Puesto[]>
  createPuesto(areaId: string, data: Partial<NewPuesto>): Promise<Puesto>
  updatePuesto(id: string, data: Partial<NewPuesto>): Promise<Puesto>
  deletePuesto(id: string): Promise<void>
}

export interface ContadorRepo {
  findByKey(areaOwnerId: string, tipo: 'ci' | 'of', year: number | null): Promise<Contador | null>
  create(areaOwnerId: string, tipo: 'ci' | 'of', year: number | null): Promise<Contador>
  reiniciar(id: string, glosa: string): Promise<Contador>
  incrementUltimoNumero(id: string): Promise<number>
  list(): Promise<Contador[]>
  findById(id: string): Promise<Contador | null>
}

export interface DocumentoRepo {
  create(data: NewDocumento): Promise<Documento>
  findById(id: string): Promise<Documento | null>
  findByIdWithDetails(id: string): Promise<{
    documento: Documento
    areaSigla: string
    areaName: string
    creadorName: string
    destinatarioName: string | null
    files: DocumentFile[]
  } | null>
  list(filters: {
    q?: string
    areaId?: string
    tipo?: 'ci' | 'of'
    year?: number
    estado?: 'activo' | 'anulado' | 'todos'
    soloMios?: boolean
    userId?: string
    page: number
    perPage: number
  }): Promise<{
    items: Array<
      Documento & {
        areaName: string
        areaSigla: string
        creadorName: string
        destinatarioName: string | null
      }
    >
    total: number
  }>
  countIssuedForYear(contadorId: string, year: number): Promise<number>
  countByCreador(userId: string): Promise<number>
  anular(id: string): Promise<void>
  update(id: string, data: {
    referencia?: string
    descripcion?: string | null
    destinatarioUserId?: string | null
    destinatarioTexto?: string | null
    fechaDocumento?: Date
  }): Promise<Documento>
  countByArea(areaId: string): Promise<number>
}

export interface DocumentFileRepo {
  create(data: {
    documentoId: string
    nombreOriginal: string
    mime: string
    size: number
    path: string
  }): Promise<DocumentFile>
  delete(id: string): Promise<void>
  findById(id: string): Promise<DocumentFile | null>
}

export interface SessionRepo {
  create(data: { id: string; userId: string; expiresAt: Date }): Promise<void>
  findById(id: string): Promise<Session | null>
  deleteById(id: string): Promise<void>
  deleteByUser(userId: string): Promise<void>
  touch(id: string, fecha: Date): Promise<void>
}

export interface AuditRepo {
  createReset(data: {
    contadorId: string
    realizadoPor: string
    glosa: string
    numeroAnterior: number
    numeroNuevo: number
  }): Promise<Reseteo>
  resetsByContador(contadorId: string): Promise<Reseteo[]>
  countRecentAttempts(email: string | null, ip: string, seconds: number): Promise<number>
  recordAttempt(data: { email: string | null; ip: string; success: boolean }): Promise<void>
}

export interface SettingsRepo {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

export interface Repos {
  users: UserRepo
  areas: AreaRepo
  contadores: ContadorRepo
  documentos: DocumentoRepo
  files: DocumentFileRepo
  sessions: SessionRepo
  audit: AuditRepo
  settings: SettingsRepo
}