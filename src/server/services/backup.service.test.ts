import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import {
  BACKUP_CONFIG_DEFAULT,
  parseBackupConfig,
  validarBackupConfig,
  type BackupConfig,
} from '@/server/domain/backup'
import { BackupService } from '@/server/services/backup.service'
import { createTestDb } from '@/db/test-db'

const testDb = createTestDb()

let tmpRoot: string
let backupDir: string
let uploadDir: string

beforeEach(() => {
  testDb.setEnv()
  tmpRoot = mkdtempSync(join(os.tmpdir(), 'carto-backup-test-'))
  backupDir = join(tmpRoot, 'backups')
  uploadDir = join(tmpRoot, 'uploads')
  mkdirSync(uploadDir, { recursive: true })
  writeFileSync(join(uploadDir, 'archivo.txt'), 'contenido de prueba')
  process.env.BACKUP_DIR = backupDir
  process.env.UPLOAD_DIR = uploadDir
  process.env.BACKUP_DESTINO = 'local'
})

afterEach(async () => {
  const { repos } = await import('@/server/repo')
  await repos.settings.set('backup_estado', '')
})

describe('parseBackupConfig', () => {
  it('devuelve el default cuando no hay valor', () => {
    expect(parseBackupConfig(null)).toEqual(BACKUP_CONFIG_DEFAULT)
  })

  it('parsea un JSON válido y completa con defaults', () => {
    expect(parseBackupConfig(JSON.stringify({ habilitado: true, hora: '05:30' }))).toEqual({
      habilitado: true,
      hora: '05:30',
      retentionDias: 7,
    })
  })

  it('devuelve el default ante JSON inválido', () => {
    expect(parseBackupConfig('no-json')).toEqual(BACKUP_CONFIG_DEFAULT)
  })
})

describe('validarBackupConfig', () => {
  it('acepta una config válida', () => {
    expect(() =>
      validarBackupConfig({ habilitado: true, hora: '03:00', retentionDias: 7 }),
    ).not.toThrow()
  })

  it('rechaza hora inválida y retención fuera de rango', () => {
    expect(() =>
      validarBackupConfig({ habilitado: true, hora: '25:00', retentionDias: 0 } as BackupConfig),
    ).toThrow(/Formato inválido/)
  })
})

describe('BackupService', () => {
  it('genera un zip con la base de datos y los archivos', async () => {
    const { repos } = await import('@/server/repo')
    const servicio = new BackupService(repos)
    const estado = await servicio.crearBackup(new Date('2026-08-14T03:00:00Z'))

    expect(estado.ultimoOk).toBe(true)
    expect(estado.ultimoArchivo).toMatch(/^carto-.*\.zip$/)
    const ruta = join(backupDir, estado.ultimoArchivo!)
    expect(existsSync(ruta)).toBe(true)
    expect(estado.ultimoTamano).toBeGreaterThan(0)

    const listado = await servicio.listarBackups()
    expect(listado.length).toBe(1)
    expect(listado[0].nombre).toBe(estado.ultimoArchivo)
  })

  it('guarda la configuración y la recupera', async () => {
    const { repos } = await import('@/server/repo')
    const servicio = new BackupService(repos)
    await servicio.guardarConfig({ habilitado: true, hora: '06:15', retentionDias: 14 })
    const config = await servicio.obtenerConfig()
    expect(config).toEqual({ habilitado: true, hora: '06:15', retentionDias: 14 })
  })

  it('aplica la retención eliminando backups viejos', async () => {
    const { repos } = await import('@/server/repo')
    const { utimesSync } = await import('node:fs')
    const servicio = new BackupService(repos)
    await servicio.guardarConfig({ habilitado: true, hora: '03:00', retentionDias: 1 })

    const viejo = await servicio.crearBackup(new Date())
    utimesSync(join(backupDir, viejo.ultimoArchivo!), new Date(), new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
    await servicio.crearBackup(new Date())

    const restantes = readdirSync(backupDir).filter((f) => f.endsWith('.zip'))
    expect(restantes.length).toBe(1)
  })
})