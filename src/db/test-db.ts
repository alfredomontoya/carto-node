import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import { runMigrations } from '@/db/migrate'

export interface TestDb {
  url: string
  setEnv: () => void
  cleanup: () => void
}

export function createTestDb(): TestDb {
  const dir = mkdtempSync(join(os.tmpdir(), 'carto-test-'))
  const url = `file:${join(dir, 'test.db')}`

  runMigrations(url)

  return {
    url,
    setEnv: () => {
      process.env.DATABASE_URL = url
    },
    cleanup: () => {
      // el cliente libsql reabre la conexión bajo demanda y puede retener el archivo;
      // por eso el borrado es best-effort (se libera al terminar el proceso).
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    },
  }
}

/** Borra todas las filas de las tablas para que cada test inicie limpio. */
export async function limpiarTablas(): Promise<void> {
  const { db } = await import('@/db/client')
  const { sql } = await import('drizzle-orm')
  const tabs = [
    'resets',
    'document_files',
    'documentos',
    'contadores',
    'module_assignments',
    'user_areas',
    'sessions',
    'login_attempts',
    'puestos',
    'areas',
    'users',
  ]
  for (const t of tabs) {
    await db.run(sql.raw(`DELETE FROM "${t}"`))
  }
  await db.run(sql.raw(`DELETE FROM sqlite_sequence WHERE name IN ('${tabs.join("','")}')`))
}