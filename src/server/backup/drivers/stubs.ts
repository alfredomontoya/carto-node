import type { DatabaseDumper } from '../interface'

export const mysqlDumper: DatabaseDumper = {
  async dump(): Promise<void> {
    throw new Error('Dumper "mysql" no implementado aún. Usa mysqldump y escríbelo en src/server/backup/drivers/mysql.ts.')
  },
}

export const mongodbDumper: DatabaseDumper = {
  async dump(): Promise<void> {
    throw new Error('Dumper "mongodb" no implementado aún. Usa mongodump/export JSON y escríbelo en src/server/backup/drivers/mongodb.ts.')
  },
}