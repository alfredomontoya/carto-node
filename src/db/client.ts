import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const url = process.env.DATABASE_URL ?? 'file:./data/carto.db'

function ensureDirectory(): void {
  if (!url.startsWith('file:')) return
  const filePath = url.replace(/^file:/, '')
  if (filePath === ':memory:' || filePath === '') return
  mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true })
}

function createDatabase() {
  ensureDirectory()
  const client = createClient({ url })
  return drizzle({ client, schema })
}

const globalForDb = globalThis as unknown as { __cartoDb?: ReturnType<typeof createDatabase> }

export const db = globalForDb.__cartoDb ?? createDatabase()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__cartoDb = db
}
