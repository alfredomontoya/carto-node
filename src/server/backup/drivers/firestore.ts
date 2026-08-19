import { writeFile } from 'node:fs/promises'
import { db } from '@/server/firebase/admin'
import type { DatabaseDumper } from '../interface'

const COLECCIONES = [
  'users',
  'user_emails',
  'areas',
  'area_siglas',
  'puestos',
  'user_areas',
  'module_assignments',
  'contadores',
  'documentos',
  'document_files',
  'resets',
  'sessions',
  'login_attempts',
  'settings',
]

function serializar(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString()
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate(): unknown }).toDate === 'function') {
    return (v as { toDate(): Date }).toDate().toISOString()
  }
  if (Array.isArray(v)) return v.map(serializar)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) out[k] = serializar(val)
    return out
  }
  return v
}

/** Exporta todas las colecciones de Firestore a un único archivo JSON. */
export const firestoreDumper: DatabaseDumper = {
  async dump(rutaDestino: string): Promise<void> {
    const salida: Record<string, unknown[]> = {}
    for (const nombre of COLECCIONES) {
      const snap = await db.collection(nombre).get()
      salida[nombre] = snap.docs.map((d) => ({ id: d.id, ...(serializar(d.data()) as Record<string, unknown>) }))
    }
    await writeFile(rutaDestino, JSON.stringify(salida, null, 2), 'utf-8')
  },
}