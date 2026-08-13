import { sql } from 'drizzle-orm'
import {
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'user', 'guest'] }).notNull().default('user'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
})

export const moduleAssignments = sqliteTable(
  'module_assignments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    module: text('module', {
      enum: ['areas', 'documentos', 'contadores', 'usuarios', 'reportes'],
    })
      .notNull(),
  },
  (t) => [uniqueIndex('module_assignments_user_module_unique').on(t.userId, t.module)],
)

export const areas = sqliteTable(
  'areas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    parentId: integer('parent_id'),
    name: text('name').notNull(),
    sigla: text('sigla').notNull().unique(),
    description: text('description'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    numeracionMode: text('numeracion_mode', { enum: ['propia', 'hereda'] })
      .notNull()
      .default('hereda'),
    reiniciaAnualmente: integer('reinicia_anualmente', { mode: 'boolean' })
      .notNull()
      .default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }).onDelete('set null'),
    index('areas_parent_id_index').on(t.parentId),
  ],
)

export const puestos = sqliteTable(
  'puestos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    areaId: integer('area_id')
      .notNull()
      .references(() => areas.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sigla: text('sigla').notNull(),
    description: text('description'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  },
  (t) => [index('puestos_area_id_index').on(t.areaId)],
)

export const userAreas = sqliteTable(
  'user_areas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    areaId: integer('area_id')
      .notNull()
      .references(() => areas.id, { onDelete: 'restrict' }),
    puestoId: integer('puesto_id').references(() => puestos.id, { onDelete: 'set null' }),
    fechaInicio: integer('fecha_inicio', { mode: 'timestamp_ms' }).notNull(),
    fechaFin: integer('fecha_fin', { mode: 'timestamp_ms' }),
    activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_areas_active_unique')
      .on(t.userId)
      .where(sql`${t.activa} = 1`),
    index('user_areas_user_id_index').on(t.userId),
    index('user_areas_area_id_index').on(t.areaId),
  ],
)

export const contadores = sqliteTable(
  'contadores',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    areaOwnerId: integer('area_owner_id')
      .notNull()
      .references(() => areas.id, { onDelete: 'cascade' }),
    tipo: text('tipo', { enum: ['ci', 'of'] }).notNull(),
    year: integer('year'),
    ciclo: integer('ciclo').notNull().default(1),
    ultimoNumero: integer('ultimo_numero').notNull().default(0),
    resetGlosa: text('reset_glosa'),
    ultimoResetAt: integer('ultimo_reset_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('contadores_owner_tipo_year_unique').on(t.areaOwnerId, t.tipo, t.year)],
)

export const documentos = sqliteTable(
  'documentos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    areaId: integer('area_id')
      .notNull()
      .references(() => areas.id, { onDelete: 'restrict' }),
    contadorId: integer('contador_id')
      .notNull()
      .references(() => contadores.id, { onDelete: 'restrict' }),
    tipo: text('tipo', { enum: ['ci', 'of'] }).notNull(),
    year: integer('year').notNull(),
    ciclo: integer('ciclo').notNull(),
    numero: integer('numero').notNull(),
    nroCompleto: text('nro_completo').notNull(),
    referencia: text('referencia').notNull(),
    descripcion: text('descripcion'),
    destinatarioUserId: integer('destinatario_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    destinatarioTexto: text('destinatario_texto'),
    fechaDocumento: integer('fecha_documento', { mode: 'timestamp_ms' }).notNull(),
    creadoPor: integer('creado_por')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    estado: text('estado', { enum: ['activo', 'anulado'] }).notNull().default('activo'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('documentos_contador_ciclo_numero_unique').on(
      t.contadorId,
      t.ciclo,
      t.numero,
    ),
    index('documentos_area_tipo_fecha_index').on(t.areaId, t.tipo, t.fechaDocumento),
    index('documentos_creado_por_index').on(t.creadoPor),
    index('documentos_contador_id_index').on(t.contadorId),
  ],
)

export const documentFiles = sqliteTable('document_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentoId: integer('documento_id')
    .notNull()
    .references(() => documentos.id, { onDelete: 'cascade' }),
  nombreOriginal: text('nombre_original').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  path: text('path').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
})

export const resets = sqliteTable('resets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contadorId: integer('contador_id')
    .notNull()
    .references(() => contadores.id, { onDelete: 'cascade' }),
  realizadoPor: integer('realizado_por')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  glosa: text('glosa').notNull(),
  numeroAnterior: integer('numero_anterior').notNull().default(0),
  numeroNuevo: integer('numero_nuevo').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
})

export const loginAttempts = sqliteTable('login_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email'),
  ip: text('ip').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Area = typeof areas.$inferSelect
export type NewArea = typeof areas.$inferInsert
export type Puesto = typeof puestos.$inferSelect
export type NewPuesto = typeof puestos.$inferInsert
export type UserArea = typeof userAreas.$inferSelect
export type Contador = typeof contadores.$inferSelect
export type Documento = typeof documentos.$inferSelect
export type NewDocumento = typeof documentos.$inferInsert
export type DocumentFile = typeof documentFiles.$inferSelect
export type Reseteo = typeof resets.$inferSelect
export type Session = typeof sessions.$inferSelect
export type ModuleAssignment = typeof moduleAssignments.$inferSelect