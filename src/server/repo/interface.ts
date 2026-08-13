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
  findById(id: number): Promise<User | null>
  findByIdentifier(id: number | string): Promise<UserWithModules | null>
  list(search?: string): Promise<UserWithModules[]>
  create(data: NewUser): Promise<User>
  update(id: number, data: Partial<NewUser>): Promise<User>
  archive(id: number): Promise<User>
  count(): Promise<number>
  setModules(userId: number, modules: Modulo[]): Promise<void>
  activeUserArea(userId: number): Promise<UserArea | null>
  activeUserAreaWithDetails(userId: number): Promise<{
    userAreaId: number
    areaId: number | null
    areaName: string | null
    areaSigla: string | null
    areaActive: boolean | null
    puestoId: number | null
    puestoName: string | null
  } | null>
  createUserArea(data: {
    userId: number
    areaId: number
    puestoId: number | null
    fechaInicio: Date
  }): Promise<UserArea>
  deactivateUserArea(userAreaId: number, fechaFin: Date): Promise<void>
  userAreaHistory(userId: number): Promise<Array<UserArea & { areaName: string | null; puestoName: string | null }>>
  setActiveAssignment(userId: number, areaId: number, puestoId: number | null): Promise<void>
}

export interface AreaRepo {
  listAll(): Promise<Area[]>
  findById(id: number): Promise<Area | null>
  create(data: Partial<NewArea>): Promise<Area>
  update(id: number, data: Partial<NewArea>): Promise<Area>
  delete(id: number): Promise<void>
  countByParent(parentId: number): Promise<number>
  countUsersInArea(areaId: number): Promise<number>
  puestosByArea(areaId: number): Promise<Puesto[]>
  createPuesto(areaId: number, data: Partial<NewPuesto>): Promise<Puesto>
  updatePuesto(id: number, data: Partial<NewPuesto>): Promise<Puesto>
  deletePuesto(id: number): Promise<void>
}

export interface ContadorRepo {
  findByKey(areaOwnerId: number, tipo: 'ci' | 'of', year: number | null): Promise<Contador | null>
  create(areaOwnerId: number, tipo: 'ci' | 'of', year: number | null): Promise<Contador>
  reiniciar(id: number, glosa: string): Promise<Contador>
  incrementUltimoNumero(id: number): Promise<number>
  list(): Promise<Contador[]>
  findById(id: number): Promise<Contador | null>
}

export interface DocumentoRepo {
  create(data: NewDocumento): Promise<Documento>
  findById(id: number): Promise<Documento | null>
  findByIdWithDetails(id: number): Promise<{
    documento: Documento
    areaSigla: string
    areaName: string
    creadorName: string
    destinatarioName: string | null
    files: DocumentFile[]
  } | null>
  list(filters: {
    q?: string
    areaId?: number
    tipo?: 'ci' | 'of'
    year?: number
    estado?: 'activo' | 'anulado' | 'todos'
    soloMios?: boolean
    userId?: number
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
  countIssuedForYear(contadorId: number, year: number): Promise<number>
  countByCreador(userId: number): Promise<number>
  anular(id: number): Promise<void>
  update(id: number, data: {
    referencia?: string
    descripcion?: string | null
    destinatarioUserId?: number | null
    destinatarioTexto?: string | null
    fechaDocumento?: Date
  }): Promise<Documento>
  countByArea(areaId: number): Promise<number>
}

export interface DocumentFileRepo {
  create(data: {
    documentoId: number
    nombreOriginal: string
    mime: string
    size: number
    path: string
  }): Promise<DocumentFile>
  delete(id: number): Promise<void>
  findById(id: number): Promise<DocumentFile | null>
}

export interface SessionRepo {
  create(data: { id: string; userId: number; expiresAt: Date }): Promise<void>
  findById(id: string): Promise<Session | null>
  deleteById(id: string): Promise<void>
  deleteByUser(userId: number): Promise<void>
  touch(id: string, fecha: Date): Promise<void>
}

export interface AuditRepo {
  createReset(data: {
    contadorId: number
    realizadoPor: number
    glosa: string
    numeroAnterior: number
    numeroNuevo: number
  }): Promise<Reseteo>
  resetsByContador(contadorId: number): Promise<Reseteo[]>
  countRecentAttempts(email: string | null, ip: string, seconds: number): Promise<number>
  recordAttempt(data: { email: string | null; ip: string; success: boolean }): Promise<void>
}

export interface Repos {
  users: UserRepo
  areas: AreaRepo
  contadores: ContadorRepo
  documentos: DocumentoRepo
  files: DocumentFileRepo
  sessions: SessionRepo
  audit: AuditRepo
}