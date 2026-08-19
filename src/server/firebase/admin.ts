import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>

let cachedApp: App | null = null

/** Devuelve la app de Firebase inicializada. En Cloud Functions se autoinicializa;
 *  en local/dev usa FIREBASE_SERVICE_ACCOUNT (JSON) o GOOGLE_APPLICATION_CREDENTIALS. */
export function app(): App {
  if (cachedApp) return cachedApp
  const existente = getApps()[0]
  if (existente) {
    cachedApp = existente
    return existente
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT
  cachedApp = initializeApp(json ? { credential: cert(JSON.parse(json)) } : {})
  return cachedApp
}

/** Firestore de Firebase (Admin SDK). Usa el emulador si FIRESTORE_EMULATOR_HOST está definido. */
export const db: Firestore = getFirestore(app())

/** Bucket de Cloud Storage (Firebase Storage). Requiere STORAGE_BUCKET. */
export function storageBucket(): Bucket {
  const name = process.env.STORAGE_BUCKET
  if (!name) throw new Error('STORAGE_BUCKET no está configurado.')
  return getStorage(app()).bucket(name)
}

/** Convierte cualquier representación de fecha de Firestore (Timestamp, Date, ms) a Date. */
export function toDate(v: unknown): Date {
  if (v instanceof Date) return v
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate(): unknown }).toDate === 'function') {
    return (v as { toDate(): Date }).toDate()
  }
  if (typeof v === 'number') return new Date(v)
  if (typeof v === 'string') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? new Date(0) : d
  }
  return new Date(0)
}