import type { Repos } from './interface'
import { sqliteRepos } from './drivers/sqlite'

export type { Repos }
export {
  type AreaRepo,
  type AuditRepo,
  type ContadorRepo,
  type DocumentFileRepo,
  type DocumentoRepo,
  type SessionRepo,
  type SettingsRepo,
  type UserRepo,
  type UserWithModules,
} from './interface'

type DriverName = 'sqlite' | 'mysql' | 'mssql' | 'firestore' | 'mongodb'

// Cada motor de base de datos implementa la misma interfaz Repos
// (src/server/repo/interface.ts) y se registra aquí. El motor activo se
// elige con la variable de entorno DB_DRIVER (por defecto: sqlite).
//
//   sqlite    -> Drizzle sqlite-core + @libsql/client  (drivers/sqlite.ts)  ✅
//   mysql     -> Drizzle mysql-core + mysql2            (drivers/mysql.ts)  🚧
//   mssql     -> Drizzle mssql-core + mssql             (drivers/mssql.ts)  🚧
//   firestore -> SDK de Firebase                        (drivers/firestore.ts) 🚧
//   mongodb   -> driver oficial de MongoDB              (drivers/mongodb.ts)  🚧
//
// Las migraciones SQL en drizzle/*.sql son específicas de SQLite. Para otros
// motores usa drizzle-kit generate/push (MySQL/MSSQL) o el esquema del motor.
const DRIVERS: Record<DriverName, () => Repos> = {
  sqlite: () => sqliteRepos,
  mysql: () => {
    throw new Error('Driver "mysql" no implementado aún. Implementa Repos en src/server/repo/drivers/mysql.ts y regístralo aquí.')
  },
  mssql: () => {
    throw new Error('Driver "mssql" no implementado aún. Implementa Repos en src/server/repo/drivers/mssql.ts y regístralo aquí.')
  },
  firestore: () => {
    throw new Error('Driver "firestore" no implementado aún. Implementa Repos en src/server/repo/drivers/firestore.ts y regístralo aquí.')
  },
  mongodb: () => {
    throw new Error('Driver "mongodb" no implementado aún. Implementa Repos en src/server/repo/drivers/mongodb.ts y regístralo aquí.')
  },
}

const driver = (process.env.DB_DRIVER ?? 'sqlite') as DriverName

function cargarRepos(): Repos {
  const crear = DRIVERS[driver]
  if (!crear) {
    throw new Error(`DB_DRIVER "${driver}" no es válido. Valores admitidos: ${Object.keys(DRIVERS).join(', ')}.`)
  }
  return crear()
}

export const repos: Repos = cargarRepos()
