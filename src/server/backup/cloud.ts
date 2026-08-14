import type { CloudBackupStorage } from './interface'

function gcsStorage(bucketName: string): CloudBackupStorage {
  let storagePromise: Promise<import('@google-cloud/storage').Storage> | null = null
  return {
    async subir(archivo: string, nombre: string): Promise<void> {
      if (!storagePromise) {
        storagePromise = import('@google-cloud/storage').then((m) => new m.Storage())
      }
      const storage = await storagePromise
      const bucket = storage.bucket(bucketName)
      await bucket.upload(archivo, { destination: `backups/${nombre}` })
    },
  }
}

/** Devuelve el adaptador de nube según BACKUP_DESTINO o null si no hay nube configurada. */
export function obtenerAlmacenamientoNube(): CloudBackupStorage | null {
  const destino = (process.env.BACKUP_DESTINO ?? 'local')
    .split(',')
    .map((s) => s.trim().toLowerCase())
  if (!destino.includes('gcs')) return null
  const bucket = process.env.BACKUP_GCS_BUCKET
  if (!bucket) return null
  return gcsStorage(bucket)
}