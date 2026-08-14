import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { repos } from '@/server/repo'
import { BackupService } from '@/server/services/backup.service'

async function main() {
  const servicio = new BackupService(repos)
  const config = await servicio.obtenerConfig()
  console.log(`Iniciando respaldo... (DB_DRIVER=${process.env.DB_DRIVER ?? 'sqlite'})`)
  const estado = await servicio.crearBackup()
  console.log(
    estado.ultimoOk
      ? `Respaldo completado: ${estado.ultimoArchivo} (${formatBytes(estado.ultimoTamano)}).`
      : 'El respaldo no se completó correctamente.',
  )
  console.log(`Hora configurada para el respaldo diario: ${config.hora} (${config.habilitado ? 'habilitado' : 'deshabilitado'})`)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const isMain = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}