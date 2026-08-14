import type { DatabaseDumper } from './interface'
import { sqliteDumper } from './drivers/sqlite'
import { firestoreDumper, mongodbDumper, mysqlDumper } from './drivers/stubs'

export type { DatabaseDumper, CloudBackupStorage } from './interface'

type DriverName = 'sqlite' | 'mysql' | 'mssql' | 'firestore' | 'mongodb'

// El dumper de la base de datos se elige con DB_DRIVER, igual que los repos.
//   sqlite    -> VACUUM INTO (snapshot consistente)               ✅
//   mysql     -> mysqldump                                        🚧
//   mssql     -> sqlcmd BACKUP DATABASE                           🚧
//   firestore -> export de colecciones a JSON                     🚧
//   mongodb   -> mongodump                                        🚧
const DUMPERS: Record<DriverName, () => DatabaseDumper> = {
  sqlite: () => sqliteDumper,
  mysql: () => mysqlDumper,
  mssql: () => {
    throw new Error('Dumper "mssql" no implementado aún.')
  },
  firestore: () => firestoreDumper,
  mongodb: () => mongodbDumper,
}

export function obtenerDumper(): DatabaseDumper {
  const driver = (process.env.DB_DRIVER ?? 'sqlite') as DriverName
  const crear = DUMPERS[driver]
  if (!crear) {
    throw new Error(`DB_DRIVER "${driver}" no es válido para el respaldo. Valores admitidos: ${Object.keys(DUMPERS).join(', ')}.`)
  }
  return crear()
}