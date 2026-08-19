import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { storageBucket } from '@/server/firebase/admin'
import { conflict } from '@/server/domain/errors'

export interface ArchivoGuardado {
  path: string
  size: number
}

export interface ArchivoVirtual {
  name: string
  mime: string
  size: number
  data: Uint8Array
}

export interface FileStorage {
  guardar(archivo: ArchivoVirtual): Promise<ArchivoGuardado>
  eliminar(path: string): Promise<void>
  leer(path: string): Promise<Buffer | null>
}

export const MIME_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export function validarArchivo(archivo: ArchivoVirtual, maxMb: number): void {
  const sizeMax = maxMb * 1024 * 1024
  if (archivo.size <= 0) throw conflict('El archivo está vacío.')
  if (archivo.size > sizeMax) {
    throw conflict(`El archivo "${archivo.name}" supera el tamaño máximo de ${maxMb}MB.`)
  }
  if (!(MIME_PERMITIDOS as readonly string[]).includes(archivo.mime)) {
    throw conflict(`El tipo de archivo "${archivo.mime}" no está permitido. Solo PDF, imagen o Word.`)
  }
}

class LocalStorage implements FileStorage {
  private readonly dir: string

  constructor(uploadDir: string) {
    this.dir = resolve(uploadDir)
    mkdirSync(this.dir, { recursive: true })
  }

  async guardar(archivo: ArchivoVirtual): Promise<ArchivoGuardado> {
    validarArchivo(archivo, Number(process.env.MAX_UPLOAD_MB ?? 10))
    const ext = extname(archivo.name).slice(0, 12) || ''
    const nombre = `${randomUUID()}${ext}`
    const ruta = join(this.dir, nombre)
    writeFileSync(ruta, archivo.data)
    return { path: ruta, size: archivo.data.byteLength }
  }

  async eliminar(path: string): Promise<void> {
    try {
      unlinkSync(path)
    } catch {
      // ignorar si no existe
    }
  }

  async leer(path: string): Promise<Buffer | null> {
    try {
      return readFileSync(path)
    } catch {
      return null
    }
  }
}

const globalForStorage = globalThis as unknown as { __cartoStorage?: FileStorage }

class GcsStorage implements FileStorage {
  private get bucket() {
    return storageBucket()
  }

  async guardar(archivo: ArchivoVirtual): Promise<ArchivoGuardado> {
    validarArchivo(archivo, Number(process.env.MAX_UPLOAD_MB ?? 10))
    const ext = extname(archivo.name).slice(0, 12) || ''
    const nombre = `documentos/${randomUUID()}${ext}`
    await this.bucket.file(nombre).save(archivo.data, {
      contentType: archivo.mime,
      metadata: { contentType: archivo.mime },
      resumable: false,
    })
    return { path: nombre, size: archivo.data.byteLength }
  }

  async eliminar(path: string): Promise<void> {
    try {
      await this.bucket.file(path).delete()
    } catch {
      // ignorar si no existe
    }
  }

  async leer(path: string): Promise<Buffer | null> {
    try {
      const [data] = await this.bucket.file(path).download()
      return Buffer.from(data)
    } catch {
      return null
    }
  }
}

export function obtenerStorage(): FileStorage {
  const driver = process.env.STORAGE_DRIVER ?? 'local'
  if (driver === 'local') {
    globalForStorage.__cartoStorage ??= new LocalStorage(process.env.UPLOAD_DIR ?? './uploads')
    return globalForStorage.__cartoStorage
  }
  if (driver === 'gcs') {
    globalForStorage.__cartoStorage ??= new GcsStorage()
    return globalForStorage.__cartoStorage
  }
  // future adapters: cloudinary, s3 — implementan la misma interfaz FileStorage
  throw new Error(`Driver de almacenamiento no soportado todavía: ${driver}`)
}