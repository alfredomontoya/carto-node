import { randomUUID } from 'node:crypto'
import type { DocumentSnapshot, Query } from 'firebase-admin/firestore'
import { db, toDate } from '@/server/firebase/admin'
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
import type {
  AreaRepo,
  AuditRepo,
  ContadorRepo,
  DocumentFileRepo,
  DocumentoRepo,
  Repos,
  SessionRepo,
  SettingsRepo,
  UserRepo,
  UserWithModules,
} from '../interface'

type DocData = Record<string, unknown>

/** Quita la propiedad `id` para guardar solo los campos de datos. */
function toDoc(entity: Record<string, unknown>): DocData {
  const copia = { ...entity }
  delete copia.id
  return copia
}

/** Convierte un snapshot en la entidad (id + campos, timestamps a Date). */
function fromDoc<T>(snap: DocumentSnapshot): T {
  const raw = snap.data() ?? {}
  const out: Record<string, unknown> = { id: snap.id }
  for (const k of Object.keys(raw)) {
    const v = raw[k]
    out[k] = v && typeof v === 'object' && 'toDate' in v ? toDate(v) : v
  }
  return out as T
}

/** Quita campos con valor `undefined` (Firestore rechaza undefined). */
function limpiar(data: Record<string, unknown>): DocData {
  const out: DocData = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

const C = {
  users: () => db.collection('users'),
  userEmails: () => db.collection('user_emails'),
  areas: () => db.collection('areas'),
  areaSiglas: () => db.collection('area_siglas'),
  puestos: () => db.collection('puestos'),
  userAreas: () => db.collection('user_areas'),
  moduleAssignments: () => db.collection('module_assignments'),
  contadores: () => db.collection('contadores'),
  documentos: () => db.collection('documentos'),
  documentFiles: () => db.collection('document_files'),
  resets: () => db.collection('resets'),
  sessions: () => db.collection('sessions'),
  loginAttempts: () => db.collection('login_attempts'),
  settings: () => db.collection('settings'),
}

async function getUser(id: string): Promise<User | null> {
  const snap = await C.users().doc(id).get()
  return snap.exists ? fromDoc<User>(snap) : null
}

function contadorKey(areaOwnerId: string, tipo: 'ci' | 'of', year: number | null): string {
  return `${areaOwnerId}_${tipo}_${year ?? 'null'}`
}

const usersRepo: UserRepo = {
  async findByEmail(email) {
    const pointer = await C.userEmails().doc(email.toLowerCase()).get()
    if (!pointer.exists) return null
    return getUser(String(pointer.get('userId')))
  },

  async findById(id) {
    return getUser(id)
  },

  async findByIdentifier(id) {
    const conModulos = async (u: User): Promise<UserWithModules> => {
      const assignments = await C.moduleAssignments().where('userId', '==', u.id).get()
      return { ...u, moduleAssignments: assignments.docs.map((d) => fromDoc<ModuleAssignment>(d)) }
    }
    const user = await getUser(id)
    if (user) return conModulos(user)
    const porEmail = await this.findByEmail(id)
    return porEmail ? conModulos(porEmail) : null
  },

  async list(search) {
    const users = (await C.users().get()).docs.map((d) => fromDoc<User>(d))
    const assignments = (await C.moduleAssignments().get()).docs.map((d) => fromDoc<ModuleAssignment>(d))
    const filtrados = search
      ? users.filter(
          (u) =>
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase()),
        )
      : users
    const ordenados: UserWithModules[] = filtrados
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((u) => ({ ...u, moduleAssignments: assignments.filter((a) => a.userId === u.id) }))
    return ordenados
  },

  async create(data: NewUser) {
    const id = data.id ?? randomUUID()
    await db.runTransaction(async (tx) => {
      const email = data.email.toLowerCase()
      const pointerRef = C.userEmails().doc(email)
      const existente = await tx.get(pointerRef)
      if (existente.exists) throw new Error('Ya existe un usuario con ese nombre de usuario.')
      tx.set(pointerRef, { userId: id })
      tx.set(C.users().doc(id), limpiar(toDoc({ ...data, id })))
    })
    const creado = await getUser(id)
    if (!creado) throw new Error('No se pudo crear el usuario.')
    return creado
  },

  async update(id, data) {
    const ahora = new Date()
    await C.users().doc(id).update(limpiar({ ...toDoc(data), updatedAt: ahora }))
    const actualizado = await getUser(id)
    if (!actualizado) throw new Error('El usuario no existe.')
    return actualizado
  },

  async archive(id) {
    await C.users().doc(id).update({ active: false, updatedAt: new Date() })
    const archivado = await getUser(id)
    if (!archivado) throw new Error('El usuario no existe.')
    return archivado
  },

  async count() {
    const snap = await C.users().count().get()
    return snap.data().count
  },

  async setModules(userId, modules: Modulo[]) {
    const existentes = await C.moduleAssignments().where('userId', '==', userId).get()
    const batch = db.batch()
    for (const d of existentes.docs) batch.delete(d.ref)
    for (const m of modules) {
      batch.set(C.moduleAssignments().doc(`${userId}_${m}`), { userId, module: m })
    }
    await batch.commit()
  },

  async activeUserArea(userId) {
    const snap = await C.userAreas().doc(`${userId}_active`).get()
    return snap.exists ? fromDoc<UserArea>(snap) : null
  },

  async activeUserAreaWithDetails(userId) {
    const snap = await C.userAreas().doc(`${userId}_active`).get()
    if (!snap.exists) return null
    const ua = fromDoc<UserArea>(snap)
    const [area, puesto] = await Promise.all([
      ua.areaId ? C.areas().doc(ua.areaId).get() : Promise.resolve(null),
      ua.puestoId ? C.puestos().doc(ua.puestoId).get() : Promise.resolve(null),
    ])
    return {
      userAreaId: ua.id,
      areaId: area?.exists ? ua.areaId : null,
      areaName: area?.exists ? String(area.get('name')) : null,
      areaSigla: area?.exists ? String(area.get('sigla')) : null,
      areaActive: area?.exists ? Boolean(area.get('active')) : null,
      puestoId: puesto?.exists ? ua.puestoId : null,
      puestoName: puesto?.exists ? String(puesto.get('name')) : null,
    }
  },

  async createUserArea(data) {
    const id = randomUUID()
    await C.userAreas().doc(id).set(toDoc({ ...data, id, activa: true, createdAt: new Date() }))
    const snap = await C.userAreas().doc(id).get()
    return fromDoc<UserArea>(snap)
  },

  async deactivateUserArea(userAreaId, fechaFin) {
    await C.userAreas().doc(userAreaId).update({ activa: false, fechaFin })
  },

  async setActiveAssignment(userId, areaId, puestoId) {
    await db.runTransaction(async (tx) => {
      const activeRef = C.userAreas().doc(`${userId}_active`)
      const actual = await tx.get(activeRef)
      if (actual.exists) {
        const histId = randomUUID()
        tx.set(C.userAreas().doc(histId), {
          ...(actual.data() as DocData),
          id: histId,
          activa: false,
          fechaFin: new Date(),
        })
      }
      tx.set(activeRef, { id: `${userId}_active`, userId, areaId, puestoId, fechaInicio: new Date(), activa: true, createdAt: new Date() })
    })
  },

  async userAreaHistory(userId) {
    const snap = await C.userAreas().where('userId', '==', userId).orderBy('fechaInicio', 'desc').get()
    const rows = snap.docs.map((d) => fromDoc<UserArea>(d))
    const areaIds = [...new Set(rows.map((r) => r.areaId).filter((x): x is string => Boolean(x)))]
    const puestoIds = [...new Set(rows.map((r) => r.puestoId).filter((x): x is string => Boolean(x)))]
    const [areas, puestos] = await Promise.all([
      areaIds.length > 0 ? Promise.all(areaIds.map((id) => C.areas().doc(id).get())) : Promise.resolve([]),
      puestoIds.length > 0 ? Promise.all(puestoIds.map((id) => C.puestos().doc(id).get())) : Promise.resolve([]),
    ])
    const areaN = new Map(areas.filter((d) => d.exists).map((d) => [d.id, String(d.get('name'))]))
    const puestoN = new Map(puestos.filter((d) => d.exists).map((d) => [d.id, String(d.get('name'))]))
    return rows.map((r) => ({
      ...r,
      areaName: r.areaId ? areaN.get(r.areaId) ?? null : null,
      puestoName: r.puestoId ? puestoN.get(r.puestoId) ?? null : null,
    }))
  },
}

const areasRepo: AreaRepo = {
  async listAll() {
    const snap = await C.areas().orderBy('name', 'asc').get()
    return snap.docs.map((d) => fromDoc<Area>(d))
  },

  async findById(id) {
    const snap = await C.areas().doc(id).get()
    return snap.exists ? fromDoc<Area>(snap) : null
  },

  async create(data: Partial<NewArea>) {
    const id = data.id ?? randomUUID()
    const sigla = (data.sigla ?? '').toUpperCase()
    await db.runTransaction(async (tx) => {
      const pointerRef = C.areaSiglas().doc(sigla)
      const existente = await tx.get(pointerRef)
      if (existente.exists) throw new Error('Ya existe un área con esa sigla.')
      tx.set(pointerRef, { areaId: id })
      tx.set(C.areas().doc(id), limpiar(toDoc({ ...data, id, sigla })))
    })
    const creada = await this.findById(id)
    if (!creada) throw new Error('No se pudo crear el área.')
    return creada
  },

  async update(id, data) {
    const ahora = new Date()
    await C.areas().doc(id).update(limpiar({ ...toDoc(data), updatedAt: ahora }))
    const actualizada = await this.findById(id)
    if (!actualizada) throw new Error('El área no existe.')
    return actualizada
  },

  async delete(id) {
    const area = await this.findById(id)
    if (area?.sigla) await C.areaSiglas().doc(area.sigla).delete()
    await C.areas().doc(id).delete()
  },

  async countByParent(parentId) {
    const snap = await C.areas().where('parentId', '==', parentId).count().get()
    return snap.data().count
  },

  async countUsersInArea(areaId) {
    const snap = await C.userAreas().where('areaId', '==', areaId).where('activa', '==', true).count().get()
    return snap.data().count
  },

  async puestosByArea(areaId) {
    const snap = await C.puestos().where('areaId', '==', areaId).orderBy('name', 'asc').get()
    return snap.docs.map((d) => fromDoc<Puesto>(d))
  },

  async createPuesto(areaId, data: Partial<NewPuesto>) {
    const id = data.id ?? randomUUID()
    const ahora = new Date()
    await C.puestos().doc(id).set(toDoc({ ...data, id, areaId, createdAt: ahora, updatedAt: ahora }))
    const snap = await C.puestos().doc(id).get()
    return fromDoc<Puesto>(snap)
  },

  async updatePuesto(id, data) {
    await C.puestos().doc(id).update(limpiar({ ...toDoc(data), updatedAt: new Date() }))
    const snap = await C.puestos().doc(id).get()
    if (!snap.exists) throw new Error('El puesto no existe.')
    return fromDoc<Puesto>(snap)
  },

  async deletePuesto(id) {
    await C.puestos().doc(id).delete()
  },
}

const contadoresRepo: ContadorRepo = {
  async findByKey(areaOwnerId, tipo, year) {
    const snap = await C.contadores().doc(contadorKey(areaOwnerId, tipo, year)).get()
    return snap.exists ? fromDoc<Contador>(snap) : null
  },

  async create(areaOwnerId, tipo, year) {
    const key = contadorKey(areaOwnerId, tipo, year)
    const ahora = new Date()
    const nuevo: Contador = {
      id: key,
      areaOwnerId,
      tipo,
      year,
      ciclo: 1,
      ultimoNumero: 0,
      resetGlosa: null,
      ultimoResetAt: null,
      createdAt: ahora,
      updatedAt: ahora,
    }
    await C.contadores().doc(key).create(toDoc(nuevo))
    return nuevo
  },

  async reiniciar(id, glosa) {
    const ahora = new Date()
    const ref = C.contadores().doc(id)
    const snap = await ref.get()
    if (!snap.exists) throw new Error('Contador no existe')
    const actual = fromDoc<Contador>(snap)
    await ref.update({
      ciclo: actual.ciclo + 1,
      ultimoNumero: 0,
      resetGlosa: glosa,
      ultimoResetAt: ahora,
      updatedAt: ahora,
    })
    const nuevo = await ref.get()
    return fromDoc<Contador>(nuevo)
  },

  async incrementUltimoNumero(id) {
    return db.runTransaction(async (tx) => {
      const ref = C.contadores().doc(id)
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('Contador no existe')
      const siguiente = (Number(snap.get('ultimoNumero')) ?? 0) + 1
      tx.update(ref, { ultimoNumero: siguiente, updatedAt: new Date() })
      return siguiente
    })
  },

  async list() {
    const snap = await C.contadores().get()
    return snap.docs.map((d) => fromDoc<Contador>(d))
  },

  async findById(id) {
    const snap = await C.contadores().doc(id).get()
    return snap.exists ? fromDoc<Contador>(snap) : null
  },
}

const documentoRepo: DocumentoRepo = {
  async create(data: NewDocumento) {
    const id = `${data.contadorId}_${data.ciclo}_${data.numero}`
    const ahora = new Date()
    const nuevo: Documento = {
      ...data,
      id,
      descripcion: data.descripcion ?? null,
      destinatarioUserId: data.destinatarioUserId ?? null,
      destinatarioTexto: data.destinatarioTexto ?? null,
      estado: data.estado ?? 'activo',
      createdAt: data.createdAt ?? ahora,
      updatedAt: data.updatedAt ?? ahora,
    }
    await C.documentos().doc(id).create(toDoc(nuevo))
    return nuevo
  },

  async findById(id) {
    const snap = await C.documentos().doc(id).get()
    return snap.exists ? fromDoc<Documento>(snap) : null
  },

  async findByIdWithDetails(id) {
    const snap = await C.documentos().doc(id).get()
    if (!snap.exists) return null
    const documento = fromDoc<Documento>(snap)
    const [area, creador, destinatario, files] = await Promise.all([
      C.areas().doc(documento.areaId).get(),
      C.users().doc(documento.creadoPor).get(),
      documento.destinatarioUserId ? C.users().doc(documento.destinatarioUserId).get() : Promise.resolve(null),
      C.documentFiles().where('documentoId', '==', documento.id).get(),
    ])
    return {
      documento,
      areaSigla: area.exists ? String(area.get('sigla')) : '',
      areaName: area.exists ? String(area.get('name')) : '',
      creadorName: creador.exists ? String(creador.get('name')) : '',
      destinatarioName: destinatario?.exists ? String(destinatario.get('name')) : null,
      files: files.docs.map((d) => fromDoc<DocumentFile>(d)),
    }
  },

  async list({ q, areaId, tipo, year, estado, soloMios, userId, page, perPage }) {
    const estadoFiltro = estado === 'anulado' ? 'anulado' : estado === 'todos' ? null : 'activo'
    let query: Query = C.documentos()
    const condiciones: string[] = []
    if (estadoFiltro) {
      query = query.where('estado', '==', estadoFiltro)
      condiciones.push(`estado=${estadoFiltro}`)
    }
    if (areaId) {
      query = query.where('areaId', '==', areaId)
      condiciones.push(`areaId=${areaId}`)
    }
    if (tipo) {
      query = query.where('tipo', '==', tipo)
      condiciones.push(`tipo=${tipo}`)
    }
    if (year) {
      query = query.where('year', '==', year)
      condiciones.push(`year=${year}`)
    }
    if (soloMios && userId) {
      query = query.where('creadoPor', '==', userId)
      condiciones.push(`creadoPor=${userId}`)
    }
    const snap = await query.get()
    let docs = snap.docs.map((d) => fromDoc<Documento>(d))
    if (q) {
      const needle = q.toLowerCase()
      docs = docs.filter(
        (d) => d.referencia.toLowerCase().includes(needle) || d.nroCompleto.toLowerCase().includes(needle),
      )
    }
    docs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const total = docs.length
    const pagina = docs.slice((page - 1) * perPage, page * perPage)

    const areaIds = [...new Set(pagina.map((d) => d.areaId))]
    const creadorIds = [...new Set(pagina.map((d) => d.creadoPor))]
    const destIds = [...new Set(pagina.map((d) => d.destinatarioUserId).filter((x): x is string => Boolean(x)))]
    const [areas, creadores, destinatarios] = await Promise.all([
      areaIds.length > 0 ? Promise.all(areaIds.map((id) => C.areas().doc(id).get())) : Promise.resolve([]),
      creadorIds.length > 0 ? Promise.all(creadorIds.map((id) => C.users().doc(id).get())) : Promise.resolve([]),
      destIds.length > 0 ? Promise.all(destIds.map((id) => C.users().doc(id).get())) : Promise.resolve([]),
    ])
    const areaN = new Map(areas.filter((d) => d.exists).map((d) => [d.id, d]))
    const creadorN = new Map(creadores.filter((d) => d.exists).map((d) => [d.id, d]))
    const destN = new Map(destinatarios.filter((d) => d.exists).map((d) => [d.id, d]))

    return {
      items: pagina.map((d) => ({
        ...d,
        areaName: areaN.get(d.areaId)?.get('name') ?? '?',
        areaSigla: areaN.get(d.areaId)?.get('sigla') ?? '?',
        creadorName: creadorN.get(d.creadoPor)?.get('name') ?? '?',
        destinatarioName: d.destinatarioUserId ? (destN.get(d.destinatarioUserId)?.get('name') as string | null) ?? null : null,
      })),
      total,
    }
  },

  async countIssuedForYear(contadorId, year) {
    const snap = await C.documentos()
      .where('contadorId', '==', contadorId)
      .where('year', '==', year)
      .count()
      .get()
    return snap.data().count
  },

  async countByCreador(userId) {
    const snap = await C.documentos().where('creadoPor', '==', userId).count().get()
    return snap.data().count
  },

  async anular(id) {
    await C.documentos().doc(id).update({ estado: 'anulado', updatedAt: new Date() })
  },

  async update(id, data) {
    const ahora = new Date()
    const ref = C.documentos().doc(id)
    await ref.update(limpiar({ ...toDoc(data), updatedAt: ahora }))
    const snap = await ref.get()
    if (!snap.exists) throw new Error('El documento no existe.')
    return fromDoc<Documento>(snap)
  },

  async countByArea(areaId) {
    const snap = await C.documentos().where('areaId', '==', areaId).count().get()
    return snap.data().count
  },
}

const filesRepo: DocumentFileRepo = {
  async create(data) {
    const id = randomUUID()
    const ahora = new Date()
    await C.documentFiles().doc(id).set(toDoc({ ...data, id, createdAt: ahora }))
    const snap = await C.documentFiles().doc(id).get()
    return fromDoc<DocumentFile>(snap)
  },
  async delete(id) {
    await C.documentFiles().doc(id).delete()
  },
  async findById(id) {
    const snap = await C.documentFiles().doc(id).get()
    return snap.exists ? fromDoc<DocumentFile>(snap) : null
  },
}

const sessionsRepo: SessionRepo = {
  async create(data) {
    await C.sessions().doc(data.id).set(toDoc({ ...data, lastUsedAt: new Date(), createdAt: new Date() }))
  },
  async findById(id) {
    const snap = await C.sessions().doc(id).get()
    if (!snap.exists) return null
    const session = fromDoc<Session>(snap)
    if (session.expiresAt.getTime() < Date.now()) {
      await C.sessions().doc(id).delete()
      return null
    }
    return session
  },
  async deleteById(id) {
    await C.sessions().doc(id).delete()
  },
  async deleteByUser(userId) {
    const snap = await C.sessions().where('userId', '==', userId).get()
    const batch = db.batch()
    for (const d of snap.docs) batch.delete(d.ref)
    await batch.commit()
  },
  async touch(id, fecha) {
    await C.sessions().doc(id).update({ lastUsedAt: fecha })
  },
}

const auditRepo: AuditRepo = {
  async createReset(data) {
    const id = randomUUID()
    const ahora = new Date()
    await C.resets().doc(id).set(toDoc({ ...data, id, createdAt: ahora }))
    const snap = await C.resets().doc(id).get()
    return fromDoc<Reseteo>(snap)
  },
  async resetsByContador(contadorId) {
    const snap = await C.resets().where('contadorId', '==', contadorId).orderBy('createdAt', 'desc').get()
    return snap.docs.map((d) => fromDoc<Reseteo>(d))
  },
  async countRecentAttempts(email, ip, seconds) {
    const cutoff = new Date(Date.now() - seconds * 1000)
    const contar = async (ref: Query) => {
      const snap = await ref.where('createdAt', '>', cutoff).count().get()
      return snap.data().count
    }
    if (email) {
      const porEmail = await contar(C.loginAttempts().where('email', '==', email))
      const porIp = await contar(C.loginAttempts().where('ip', '==', ip))
      const ambos = await contar(C.loginAttempts().where('email', '==', email).where('ip', '==', ip))
      return porEmail + porIp - ambos
    }
    return contar(C.loginAttempts().where('ip', '==', ip))
  },
  async recordAttempt(data) {
    const id = randomUUID()
    await C.loginAttempts().doc(id).set(toDoc({ ...data, id, createdAt: new Date() }))
  },
}

const settingsRepo: SettingsRepo = {
  async get(key) {
    const snap = await C.settings().doc(key).get()
    return snap.exists ? String(snap.get('value')) : null
  },
  async set(key, value) {
    await C.settings().doc(key).set({ value, updatedAt: new Date() })
  },
}

export const firestoreRepos: Repos = {
  users: usersRepo,
  areas: areasRepo,
  contadores: contadoresRepo,
  documentos: documentoRepo,
  files: filesRepo,
  sessions: sessionsRepo,
  audit: auditRepo,
  settings: settingsRepo,
}