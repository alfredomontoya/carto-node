import { readdirSync, readFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'

export function ensureDirectory(url: string): void {
  if (!url.startsWith('file:')) return
  const filePath = url.replace(/^file:/, '')
  if (filePath === ':memory:' || filePath === '') return
  const dir = join(resolve(filePath), '..')
  mkdirSync(dir, { recursive: true })
}

export async function runMigrations(url: string, dir = join(process.cwd(), 'drizzle')): Promise<string[]> {
  ensureDirectory(url)
  const client = createClient({ url })
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && /^\d+_/.test(f))
    .sort()

  if (files.length === 0) return []

  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8')
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)
    const existing = await client.execute({
      sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'",
      args: [],
    })
    if (existing.rows.length === 0) {
      await client.execute(
        'CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at INTEGER)',
      )
    }
    const done = await client.execute({
      sql: 'SELECT 1 FROM __drizzle_migrations WHERE hash = ?',
      args: [f],
    })
    if (done.rows.length > 0) continue
    for (const stmt of statements) {
      if (!stmt) continue
      await client.execute(stmt)
    }
    await client.execute({
      sql: 'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
      args: [f, Date.now()],
    })
  }

  client.close()
  return files
}

async function main() {
  const url = process.env.DATABASE_URL ?? 'file:./data/carto.db'
  const applied = await runMigrations(url)
  console.log(applied.length > 0 ? 'Migración completada.' : 'No hay migraciones en drizzle/.')
}

const isMain = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}