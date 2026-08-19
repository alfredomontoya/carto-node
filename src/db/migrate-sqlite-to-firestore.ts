/**
 * Migración one-off SQLite -> Firestore.
 *
 * Convierte todos los datos de la base SQLite (DATABASE_URL) a Firestore
 * siguiendo las convenciones del driver de Firestore (src/server/repo/drivers/firestore.ts):
 *  - IDs enteros se remapean a UUIDs, preservando las relaciones.
 *  - Doc-ids naturales donde hay unicidad: contadores, documentos, módulos,
 *    asignación activa, emails/siglas (punteros).
 *
 * Uso:
 *   tsx --env-file=.env src/db/migrate-sqlite-to-firestore.ts
 *
 * Requiere en .env: DATABASE_URL (sqlite) y credenciales de Firebase
 * (FIREBASE_SERVICE_ACCOUNT o GOOGLE_APPLICATION_CREDENTIALS).
 */

import { randomUUID } from 'node:crypto'
import { db as sqlite } from '@/db/client'
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
  settings,
  userAreas,
  users,
} from '@/db/schema'
import { db as firestore } from '@/server/firebase/admin'

interface Op {
  ref: import('firebase-admin/firestore').DocumentReference
  data: Record<string, unknown>
}

interface Writes {
  set(ref: Op['ref'], data: Op['data']): void
  flush(): Promise<void>
}

function acumulador(): Writes {
  const ops: Op[] = []
  return {
    set(ref, data) {
      ops.push({ ref, data })
    },
    async flush() {
      for (let i = 0; i < ops.length; i += 400) {
        const chunk = ops.slice(i, i + 400)
        const batch = firestore.batch()
        for (const op of chunk) batch.set(op.ref, op.data)
        await batch.commit()
        console.log(`  ...${i + chunk.length} escrituras`)
      }
      ops.length = 0
    },
  }
}

async function main(): Promise<void> {
  const writes = acumulador()
  const userMap = new Map<string, string>()
  const areaMap = new Map<string, string>()
  const puestoMap = new Map<string, string>()
  const contadorMap = new Map<string, string>()
  const documentoMap = new Map<string, string>()

  console.log('Leyendo SQLite...')

  const rowsUsers = await sqlite.select().from(users)
  const rowsAreas = await sqlite.select().from(areas)
  const rowsPuestos = await sqlite.select().from(puestos)
  const rowsUserAreas = await sqlite.select().from(userAreas)
  const rowsModulos = await sqlite.select().from(moduleAssignments)
  const rowsContadores = await sqlite.select().from(contadores)
  const rowsDocumentos = await sqlite.select().from(documentos)
  const rowsFiles = await sqlite.select().from(documentFiles)
  const rowsResets = await sqlite.select().from(resets)
  const rowsSessions = await sqlite.select().from(sessions)
  const rowsIntentos = await sqlite.select().from(loginAttempts)
  const rowsSettings = await sqlite.select().from(settings)

  console.log(`  usuarios: ${rowsUsers.length}, áreas: ${rowsAreas.length}, documentos: ${rowsDocumentos.length}`)

  // ---- usuarios + punteros de email + módulos --------------------------------
  for (const u of rowsUsers) {
    const nuevo = randomUUID()
    userMap.set(u.id, nuevo)
    writes.set(firestore.collection('users').doc(nuevo), {
      id: nuevo,
      name: u.name,
      email: u.email,
      passwordHash: u.passwordHash,
      role: u.role,
      active: u.active,
      theme: u.theme,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })
    writes.set(firestore.collection('user_emails').doc(u.email), { userId: nuevo })
  }
  for (const m of rowsModulos) {
    writes.set(firestore.collection('module_assignments').doc(`${userMap.get(m.userId)}_${m.module}`), {
      userId: userMap.get(m.userId),
      module: m.module,
    })
  }
  await writes.flush()
  console.log('  usuarios migrados')

  // ---- áreas + siglas + puestos ---------------------------------------------
  for (const a of rowsAreas) {
    const nuevo = randomUUID()
    areaMap.set(a.id, nuevo)
    writes.set(firestore.collection('areas').doc(nuevo), {
      id: nuevo,
      parentId: a.parentId ? areaMap.get(a.parentId) ?? null : null,
      name: a.name,
      sigla: a.sigla,
      description: a.description ?? null,
      active: a.active,
      numeracionMode: a.numeracionMode,
      reiniciaAnualmente: a.reiniciaAnualmente,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })
    writes.set(firestore.collection('area_siglas').doc(a.sigla), { areaId: nuevo })
  }
  for (const p of rowsPuestos) {
    const nuevo = randomUUID()
    puestoMap.set(p.id, nuevo)
    writes.set(firestore.collection('puestos').doc(nuevo), {
      id: nuevo,
      areaId: areaMap.get(p.areaId),
      name: p.name,
      sigla: p.sigla,
      description: p.description ?? null,
      active: p.active,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })
  }
  await writes.flush()
  console.log('  áreas y puestos migrados')

  // ---- asignaciones de usuario (activa -> {userId}_active) ------------------
  for (const ua of rowsUserAreas) {
    const nuevoUserId = userMap.get(ua.userId)
    const nuevoAreaId = areaMap.get(ua.areaId)
    const nuevoPuestoId = ua.puestoId ? puestoMap.get(ua.puestoId) ?? null : null
    const docId = ua.activa ? `${nuevoUserId}_active` : randomUUID()
    writes.set(firestore.collection('user_areas').doc(docId), {
      id: docId,
      userId: nuevoUserId,
      areaId: nuevoAreaId,
      puestoId: nuevoPuestoId,
      fechaInicio: ua.fechaInicio,
      fechaFin: ua.fechaFin ?? null,
      activa: ua.activa,
      createdAt: ua.createdAt,
    })
  }
  await writes.flush()
  console.log('  asignaciones migradas')

  // ---- contadores (doc-id = {areaOwnerId}_{tipo}_{year}) --------------------
  for (const c of rowsContadores) {
    const nuevoOwner = areaMap.get(c.areaOwnerId)
    const key = `${nuevoOwner}_${c.tipo}_${c.year ?? 'null'}`
    contadorMap.set(c.id, key)
    writes.set(firestore.collection('contadores').doc(key), {
      id: key,
      areaOwnerId: nuevoOwner,
      tipo: c.tipo,
      year: c.year,
      ciclo: c.ciclo,
      ultimoNumero: c.ultimoNumero,
      resetGlosa: c.resetGlosa ?? null,
      ultimoResetAt: c.ultimoResetAt ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })
  }
  await writes.flush()
  console.log('  contadores migrados')

  // ---- documentos (doc-id = {contadorId}_{ciclo}_{numero}) + archivos -------
  for (const d of rowsDocumentos) {
    const docId = `${contadorMap.get(d.contadorId)}_${d.ciclo}_${d.numero}`
    documentoMap.set(d.id, docId)
    writes.set(firestore.collection('documentos').doc(docId), {
      id: docId,
      areaId: areaMap.get(d.areaId),
      contadorId: contadorMap.get(d.contadorId),
      tipo: d.tipo,
      year: d.year,
      ciclo: d.ciclo,
      numero: d.numero,
      nroCompleto: d.nroCompleto,
      referencia: d.referencia,
      descripcion: d.descripcion ?? null,
      destinatarioUserId: d.destinatarioUserId ? userMap.get(d.destinatarioUserId) ?? null : null,
      destinatarioTexto: d.destinatarioTexto ?? null,
      fechaDocumento: d.fechaDocumento,
      creadoPor: userMap.get(d.creadoPor),
      estado: d.estado,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })
  }
  for (const f of rowsFiles) {
    writes.set(firestore.collection('document_files').doc(randomUUID()), {
      documentoId: documentoMap.get(f.documentoId),
      nombreOriginal: f.nombreOriginal,
      mime: f.mime,
      size: f.size,
      path: f.path,
      createdAt: f.createdAt,
    })
  }
  await writes.flush()
  console.log('  documentos y archivos migrados')

  // ---- resets / sesiones / intentos / settings ------------------------------
  for (const r of rowsResets) {
    writes.set(firestore.collection('resets').doc(randomUUID()), {
      contadorId: contadorMap.get(r.contadorId),
      realizadoPor: userMap.get(r.realizadoPor),
      glosa: r.glosa,
      numeroAnterior: r.numeroAnterior,
      numeroNuevo: r.numeroNuevo,
      createdAt: r.createdAt,
    })
  }
  for (const s of rowsSessions) {
    writes.set(firestore.collection('sessions').doc(s.id), {
      id: s.id,
      userId: userMap.get(s.userId),
      expiresAt: s.expiresAt,
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
    })
  }
  for (const i of rowsIntentos) {
    writes.set(firestore.collection('login_attempts').doc(randomUUID()), {
      email: i.email ?? null,
      ip: i.ip,
      success: i.success,
      createdAt: i.createdAt,
    })
  }
  for (const s of rowsSettings) {
    writes.set(firestore.collection('settings').doc(s.key), {
      value: s.value,
      updatedAt: s.updatedAt,
    })
  }
  await writes.flush()

  console.log('Migración completada.')
  console.log('Revisa en la consola de Firebase que las colecciones y documentos existen.')
  console.log('Cambia DB_DRIVER=firestore en .env y despliega.')
}

main().catch((err) => {
  console.error('Error durante la migración:', err)
  process.exit(1)
})