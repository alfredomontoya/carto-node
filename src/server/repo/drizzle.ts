import { and, asc, count, desc, eq, isNull, like, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { db } from '@/db/client'
import {
  areas,
  contadores,
  documentFiles,
  documentos,
  loginAttempts,
  moduleAssignments,
  puestos,
  resets,
  sessions,
  userAreas,
  users,
  type NewArea,
  type NewDocumento,
  type NewPuesto,
  type NewUser,
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
  UserRepo,
} from './interface'

const destUsers = alias(users, 'destinatario_users')

const usersRepo: UserRepo = {
  async findByEmail(email) {
    return (await db.select().from(users).where(eq(users.email, email)).get()) ?? null
  },

  async findById(id) {
    return (await db.select().from(users).where(eq(users.id, id)).get()) ?? null
  },

  async findByIdentifier(id) {
    const numeric = typeof id === 'number' || (typeof id === 'string' && id.trim() !== '' && !Number.isNaN(Number(id)))
    const user =
      numeric
        ? (await db.select().from(users).where(eq(users.id, Number(id))).get()) ?? null
        : (await db.select().from(users).where(eq(users.email, String(id))).get()) ?? null
    if (!user) return null
    const assignments = await db
      .select()
      .from(moduleAssignments)
      .where(eq(moduleAssignments.userId, user.id))
      .all()
    return { ...user, moduleAssignments: assignments }
  },

  async list(search) {
    const rows = search
      ? await db
          .select()
          .from(users)
          .where(or(like(users.name, `%${search}%`), like(users.email, `%${search}%`)))
          .orderBy(desc(users.id))
          .all()
      : await db.select().from(users).orderBy(desc(users.id)).all()
    const assignments = await db.select().from(moduleAssignments).all()
    return rows.map((u) => ({
      ...u,
      moduleAssignments: assignments.filter((a) => a.userId === u.id),
    }))
  },

  async create(data: NewUser) {
    return (await db.insert(users).values(data).returning())[0]
  },

  async update(id, data) {
    return (
      await db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning()
    )[0]
  },

  async archive(id) {
    return (
      await db
        .update(users)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning()
    )[0]
  },

  async count() {
    return (await db.select({ c: count() }).from(users).get())?.c ?? 0
  },

  async setModules(userId, modules: Modulo[]) {
    await db.delete(moduleAssignments).where(eq(moduleAssignments.userId, userId)).run()
    if (modules.length > 0) {
      await db
        .insert(moduleAssignments)
        .values(modules.map((m) => ({ userId, module: m })))
        .run()
    }
  },

  async activeUserArea(userId) {
    return (
      (await db
        .select()
        .from(userAreas)
        .where(and(eq(userAreas.userId, userId), eq(userAreas.activa, true)))
        .get()) ?? null
    )
  },

  async activeUserAreaWithDetails(userId) {
    const row = await db
      .select({
        userAreaId: userAreas.id,
        areaId: areas.id,
        areaName: areas.name,
        areaSigla: areas.sigla,
        areaActive: areas.active,
        puestoId: puestos.id,
        puestoName: puestos.name,
      })
      .from(userAreas)
      .leftJoin(areas, eq(areas.id, userAreas.areaId))
      .leftJoin(puestos, eq(puestos.id, userAreas.puestoId))
      .where(and(eq(userAreas.userId, userId), eq(userAreas.activa, true)))
      .get()
    return row ?? null
  },

  async createUserArea(data) {
    return (
      await db
        .insert(userAreas)
        .values({
          userId: data.userId,
          areaId: data.areaId,
          puestoId: data.puestoId,
          fechaInicio: data.fechaInicio,
          activa: true,
        })
        .returning()
    )[0]
  },

  async deactivateUserArea(userAreaId, fechaFin) {
    const row = await db.select().from(userAreas).where(eq(userAreas.id, userAreaId)).get()
    if (!row) return
    await db
      .update(userAreas)
      .set({ activa: false, fechaFin })
      .where(eq(userAreas.id, userAreaId))
      .run()
  },

  async setActiveAssignment(userId, areaId, puestoId) {
    return db.transaction(async (tx) => {
      const row = await tx
        .select()
        .from(userAreas)
        .where(and(eq(userAreas.userId, userId), eq(userAreas.activa, true)))
        .get()
      if (row) {
        await tx
          .update(userAreas)
          .set({ activa: false, fechaFin: new Date() })
          .where(eq(userAreas.id, row.id))
          .run()
      }
      await tx
        .insert(userAreas)
        .values({ userId, areaId, puestoId, fechaInicio: new Date(), activa: true })
        .run()
    })
  },

  async userAreaHistory(userId) {
    return db
      .select({
        id: userAreas.id,
        userId: userAreas.userId,
        areaId: userAreas.areaId,
        puestoId: userAreas.puestoId,
        fechaInicio: userAreas.fechaInicio,
        fechaFin: userAreas.fechaFin,
        activa: userAreas.activa,
        createdAt: userAreas.createdAt,
        areaName: areas.name,
        puestoName: puestos.name,
      })
      .from(userAreas)
      .leftJoin(areas, eq(areas.id, userAreas.areaId))
      .leftJoin(puestos, eq(puestos.id, userAreas.puestoId))
      .where(eq(userAreas.userId, userId))
      .orderBy(desc(userAreas.fechaInicio))
      .all()
  },
}

const areasRepo: AreaRepo = {
  async listAll() {
    return db.select().from(areas).orderBy(asc(areas.name)).all()
  },

  async findById(id) {
    return (await db.select().from(areas).where(eq(areas.id, id)).get()) ?? null
  },

  async create(data: Partial<NewArea>) {
    return (await db.insert(areas).values(data as NewArea).returning())[0]
  },

  async update(id, data) {
    return (
      await db
        .update(areas)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(areas.id, id))
        .returning()
    )[0]
  },

  async delete(id) {
    await db.delete(areas).where(eq(areas.id, id)).run()
  },

  async countByParent(parentId) {
    return (await db.select({ c: count() }).from(areas).where(eq(areas.parentId, parentId)).get())?.c ?? 0
  },

  async countUsersInArea(areaId) {
    return (
      (await db
        .select({ c: count() })
        .from(userAreas)
        .where(and(eq(userAreas.areaId, areaId), eq(userAreas.activa, true)))
        .get())?.c ?? 0
    )
  },

  async puestosByArea(areaId) {
    return db.select().from(puestos).where(eq(puestos.areaId, areaId)).orderBy(asc(puestos.name)).all()
  },

  async createPuesto(areaId, data: Partial<NewPuesto>) {
    return (await db.insert(puestos).values({ ...data, areaId } as NewPuesto).returning())[0]
  },

  async updatePuesto(id, data) {
    return (
      await db
        .update(puestos)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(puestos.id, id))
        .returning()
    )[0]
  },

  async deletePuesto(id) {
    await db.delete(puestos).where(eq(puestos.id, id)).run()
  },
}

const contadoresRepo: ContadorRepo = {
  async findByKey(areaOwnerId, tipo, year) {
    return (
      (await db
        .select()
        .from(contadores)
        .where(
          and(
            eq(contadores.areaOwnerId, areaOwnerId),
            eq(contadores.tipo, tipo),
            year ? eq(contadores.year, year) : isNull(contadores.year),
          ),
        )
        .get()) ?? null
    )
  },

  async create(areaOwnerId, tipo, year) {
    return (
      await db
        .insert(contadores)
        .values({ areaOwnerId, tipo, year: year ?? null })
        .returning()
    )[0]
  },

  async reiniciar(id, glosa) {
    const rows = await db
      .update(contadores)
      .set({
        ciclo: sql`${contadores.ciclo} + 1`,
        ultimoNumero: 0,
        resetGlosa: glosa,
        ultimoResetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contadores.id, id))
      .returning()
    return rows[0]
  },

  async incrementUltimoNumero(id) {
    const rows = await db
      .update(contadores)
      .set({ ultimoNumero: sql`${contadores.ultimoNumero} + 1`, updatedAt: new Date() })
      .where(eq(contadores.id, id))
      .returning({ n: contadores.ultimoNumero })
    if (!rows[0]) throw new Error('Contador no existe')
    return rows[0].n
  },

  async list() {
    return db.select().from(contadores).orderBy(asc(contadores.id)).all()
  },

  async findById(id) {
    return (await db.select().from(contadores).where(eq(contadores.id, id)).get()) ?? null
  },
}

const documentoRepo: DocumentoRepo = {
  async create(data: NewDocumento) {
    return (await db.insert(documentos).values(data).returning())[0]
  },

  async findById(id) {
    return (await db.select().from(documentos).where(eq(documentos.id, id)).get()) ?? null
  },

  async findByIdWithDetails(id) {
    const row = await db
      .select({
        documento: documentos,
        areaSigla: areas.sigla,
        areaName: areas.name,
        creadorName: users.name,
        destinatarioName: destUsers.name,
      })
      .from(documentos)
      .innerJoin(areas, eq(areas.id, documentos.areaId))
      .innerJoin(users, eq(users.id, documentos.creadoPor))
      .leftJoin(destUsers, eq(destUsers.id, documentos.destinatarioUserId))
      .where(and(eq(documentos.id, id), isNull(documentos.deletedAt)))
      .get()
    if (!row) return null
    const files = await db.select().from(documentFiles).where(eq(documentFiles.documentoId, id)).all()
    return { ...row, files }
  },

  async list({ q, areaId, tipo, year, soloMios, userId, page, perPage }) {
    const where = and(
      isNull(documentos.deletedAt),
      ...(q ? [or(like(documentos.referencia, `%${q}%`), like(documentos.nroCompleto, `%${q}%`))] : []),
      ...(areaId ? [eq(documentos.areaId, areaId)] : []),
      ...(tipo ? [eq(documentos.tipo, tipo)] : []),
      ...(year ? [eq(documentos.year, year)] : []),
      ...(soloMios && userId ? [eq(documentos.creadoPor, userId)] : []),
    ) as SQL
    const total = (await db.select({ c: count() }).from(documentos).where(where).get())?.c ?? 0
    const rows = await db
      .select({
        documento: documentos,
        areaName: areas.name,
        areaSigla: areas.sigla,
        creadorName: users.name,
        destinatarioName: destUsers.name,
      })
      .from(documentos)
      .innerJoin(areas, eq(areas.id, documentos.areaId))
      .innerJoin(users, eq(users.id, documentos.creadoPor))
      .leftJoin(destUsers, eq(destUsers.id, documentos.destinatarioUserId))
      .where(where)
      .orderBy(desc(documentos.id))
      .limit(perPage)
      .offset((page - 1) * perPage)
      .all()
    return {
      items: rows.map((r) => ({ ...r.documento, areaName: r.areaName, areaSigla: r.areaSigla, creadorName: r.creadorName, destinatarioName: r.destinatarioName })),
      total,
    }
  },

  async softDelete(id) {
    await db
      .update(documentos)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(documentos.id, id))
      .run()
  },

  async update(id, data) {
    return (
      await db
        .update(documentos)
        .set({
          ...(data.referencia != null && { referencia: data.referencia }),
          ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
          ...(data.destinatarioUserId !== undefined && { destinatarioUserId: data.destinatarioUserId }),
          ...(data.destinatarioTexto !== undefined && { destinatarioTexto: data.destinatarioTexto }),
          ...(data.fechaDocumento && { fechaDocumento: data.fechaDocumento }),
          updatedAt: new Date(),
        })
        .where(eq(documentos.id, id))
        .returning()
    )[0]
  },

  async countByArea(areaId) {
    return (
      (await db
        .select({ c: count() })
        .from(documentos)
        .where(and(eq(documentos.areaId, areaId), isNull(documentos.deletedAt)))
        .get())?.c ?? 0
    )
  },
}

const filesRepo: DocumentFileRepo = {
  async create(data) {
    return (await db.insert(documentFiles).values(data).returning())[0]
  },
  async delete(id) {
    await db.delete(documentFiles).where(eq(documentFiles.id, id)).run()
  },
  async findById(id) {
    return (await db.select().from(documentFiles).where(eq(documentFiles.id, id)).get()) ?? null
  },
}

const sessionsRepo: SessionRepo = {
  async create(data) {
    await db.insert(sessions).values(data).run()
  },
  async findById(id) {
    const row = await db.select().from(sessions).where(eq(sessions.id, id)).get()
    if (!row) return null
    if (row.expiresAt.getTime() < Date.now()) {
      await db.delete(sessions).where(eq(sessions.id, id)).run()
      return null
    }
    return row
  },
  async deleteById(id) {
    await db.delete(sessions).where(eq(sessions.id, id)).run()
  },
  async deleteByUser(userId) {
    await db.delete(sessions).where(eq(sessions.userId, userId)).run()
  },
  async touch(id, fecha) {
    await db.update(sessions).set({ lastUsedAt: fecha }).where(eq(sessions.id, id)).run()
  },
}

const auditRepo: AuditRepo = {
  async createReset(data) {
    return (await db.insert(resets).values(data).returning())[0]
  },
  async resetsByContador(contadorId) {
    return db.select().from(resets).where(eq(resets.contadorId, contadorId)).orderBy(desc(resets.id)).all()
  },
  async countRecentAttempts(email, ip, seconds) {
    const cutoff = new Date(Date.now() - seconds * 1000)
    const where = and(
      sql`${loginAttempts.createdAt} > ${cutoff}`,
      ...(email && ip ? [or(eq(loginAttempts.email, email), eq(loginAttempts.ip, ip))] : [eq(loginAttempts.ip, ip)]),
    ) as SQL
    return (await db.select({ c: count() }).from(loginAttempts).where(where).get())?.c ?? 0
  },
  async recordAttempt(data) {
    await db.insert(loginAttempts).values(data).run()
  },
}

export const repos: Repos = {
  users: usersRepo,
  areas: areasRepo,
  contadores: contadoresRepo,
  documentos: documentoRepo,
  files: filesRepo,
  sessions: sessionsRepo,
  audit: auditRepo,
}
