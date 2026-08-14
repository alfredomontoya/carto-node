import {
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { join, resolve, extname } from 'node:path'
import os from 'node:os'
import { ZipArchive } from 'archiver'
import { obtenerDumper } from '@/server/backup'
import { obtenerAlmacenamientoNube } from '@/server/backup/cloud'
import {
  BACKUP_ESTADO_KEY,
  BACKUP_KEY,
  parseBackupConfig,
  validarBackupConfig,
  type BackupConfig,
} from '@/server/domain/backup'
import type { Repos } from '@/server/repo/interface'

export interface BackupEstado {
  ultimoAt: string | null
  ultimoOk: boolean
  ultimoArchivo: string | null
  ultimoTamano: number
}

export interface BackupInfo {
  nombre: string
  fecha: Date
  tamano: number
}

export class BackupService {
  constructor(private readonly repos: Repos) {}

  private get backupDir(): string {
    return resolve(process.env.BACKUP_DIR ?? './backups')
  }

  async obtenerConfig(): Promise<BackupConfig> {
    const valor = await this.repos.settings.get(BACKUP_KEY)
    return parseBackupConfig(valor)
  }

  async guardarConfig(datos: BackupConfig): Promise<void> {
    validarBackupConfig(datos)
    await this.repos.settings.set(BACKUP_KEY, JSON.stringify(datos))
  }

  async obtenerEstado(): Promise<BackupEstado> {
    const valor = await this.repos.settings.get(BACKUP_ESTADO_KEY)
    if (!valor) {
      return { ultimoAt: null, ultimoOk: false, ultimoArchivo: null, ultimoTamano: 0 }
    }
    try {
      return { ...(JSON.parse(valor) as BackupEstado) }
    } catch {
      return { ultimoAt: null, ultimoOk: false, ultimoArchivo: null, ultimoTamano: 0 }
    }
  }

  async listarBackups(): Promise<BackupInfo[]> {
    const dir = this.backupDir
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter((f) => f.endsWith('.zip'))
      .map((nombre) => {
        const ruta = join(dir, nombre)
        const st = statSync(ruta)
        return { nombre, fecha: st.mtime, tamano: st.size }
      })
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
  }

  async crearBackup(ahora = new Date()): Promise<BackupEstado> {
    mkdirSync(this.backupDir, { recursive: true })
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'carto-bk-'))
    const nombre = `carto-${formatearFecha(ahora)}.zip`
    const rutaZip = join(this.backupDir, nombre)

    try {
      const dumper = obtenerDumper()
      const ext = dumperExt(process.env.DB_DRIVER ?? 'sqlite')
      const dumpPath = join(tmpDir, `database${ext}`)
      await dumper.dump(dumpPath)

      await this.crearZip(rutaZip, tmpDir, dumpPath)

      const cloud = obtenerAlmacenamientoNube()
      if (cloud) await cloud.subir(rutaZip, nombre)

      await this.aplicarRetencion()

      const estado: BackupEstado = {
        ultimoAt: ahora.toISOString(),
        ultimoOk: true,
        ultimoArchivo: nombre,
        ultimoTamano: statSync(rutaZip).size,
      }
      await this.repos.settings.set(BACKUP_ESTADO_KEY, JSON.stringify(estado))
      return estado
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  }

  private async crearZip(rutaZip: string, tmpDir: string, dumpPath: string): Promise<void> {
    const output = createWriteStream(rutaZip)
    const archive = new ZipArchive({ zlib: { level: 9 } })

    await new Promise<void>((resolvePromise, reject) => {
      output.on('close', () => resolvePromise())
      output.on('error', reject)
      archive.on('error', reject)
      archive.pipe(output)
      archive.file(dumpPath, { name: `database${extname(dumpPath)}` })

      const uploadDir = resolve(process.env.UPLOAD_DIR ?? './uploads')
      if (existsSync(uploadDir)) {
        archive.directory(uploadDir, 'uploads')
      } else {
        archive.append('', { name: 'uploads/README.txt' })
      }

      void archive.finalize()
    })
  }

  private async aplicarRetencion(): Promise<void> {
    const dir = this.backupDir
    if (!existsSync(dir)) return
    const limiteMs = Date.now() - (await this.retentionMs())
    for (const nombre of readdirSync(dir).filter((f) => f.endsWith('.zip'))) {
      const ruta = join(dir, nombre)
      try {
        if (statSync(ruta).mtime.getTime() < limiteMs) rmSync(ruta, { force: true })
      } catch {
        /* ignore */
      }
    }
  }

  private async retentionMs(): Promise<number> {
    const config = await this.obtenerConfig()
    return config.retentionDias * 24 * 60 * 60 * 1000
  }
}

function formatearFecha(ahora: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}_${p(ahora.getHours())}-${p(ahora.getMinutes())}-${p(ahora.getSeconds())}`
}

function dumperExt(driver: string): string {
  if (driver === 'sqlite') return '.db'
  if (driver === 'mysql' || driver === 'mssql') return '.sql'
  return '.json'
}