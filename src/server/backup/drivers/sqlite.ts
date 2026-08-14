import { createClient } from '@libsql/client'
import type { DatabaseDumper } from '../interface'

export const sqliteDumper: DatabaseDumper = {
  async dump(rutaDestino: string): Promise<void> {
    const url = process.env.DATABASE_URL ?? 'file:./data/carto.db'
    if (!url.startsWith('file:')) {
      throw new Error('El respaldo SQLite solo soporta DATABASE_URL con esquema file:. Usa el snapshot del proveedor para bases remotas.')
    }
    const client = createClient({ url })
    try {
      const destino = rutaDestino.replace(/\\/g, '/').replace(/'/g, "''")
      await client.execute(`VACUUM INTO '${destino}'`)
    } finally {
      client.close()
    }
  },
}