import { readFileSync } from 'node:fs'
import { getStorage } from 'firebase-admin/storage'
import { app } from '@/server/firebase/admin'
import type { CloudBackupStorage } from './interface'

function gcsStorage(bucketName: string): CloudBackupStorage {
  const PREFIJO = 'backups/'
  return {
    async subir(archivo: string, nombre: string): Promise<void> {
      await getStorage(app())
        .bucket(bucketName)
        .file(`${PREFIJO}${nombre}`)
        .save(readFileSync(archivo), {
          contentType: 'application/zip',
          metadata: { contentType: 'application/zip' },
          resumable: false,
        })
    },
    async listar() {
      const [files] = await getStorage(app()).bucket(bucketName).getFiles({ prefix: PREFIJO })
      return files
        .map((f) => {
          const meta = f.metadata
          return {
            nombre: f.name.slice(PREFIJO.length),
            fecha: meta?.timeCreated ? new Date(meta.timeCreated) : new Date(0),
            tamano: Number(meta?.size ?? 0),
          }
        })
        .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
    },
    async borrar(nombre: string): Promise<void> {
      try {
        await getStorage(app()).bucket(bucketName).file(`${PREFIJO}${nombre}`).delete()
      } catch {
        // ignorar si no existe
      }
    },
  }
}

/** Devuelve el adaptador de nube según BACKUP_DESTINO o null si no hay nube configurada.
 *  Usa BACKUP_GCS_BUCKET si está definido; si no, STORAGE_BUCKET. */
export function obtenerAlmacenamientoNube(): CloudBackupStorage | null {
  const destino = (process.env.BACKUP_DESTINO ?? 'local')
    .split(',')
    .map((s) => s.trim().toLowerCase())
  if (!destino.includes('gcs')) return null
  const bucket = process.env.BACKUP_GCS_BUCKET || process.env.STORAGE_BUCKET
  if (!bucket) return null
  return gcsStorage(bucket)
}