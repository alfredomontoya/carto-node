import { requireAdmin } from '@/server/auth/dal'
import { repos } from '@/server/repo'
import { SistemaService } from '@/server/services/sistema.service'
import { BackupService } from '@/server/services/backup.service'
import { ConfiguracionClient } from '@/components/configuracion/configuracion-client'

const sistema = new SistemaService(repos)
const backup = new BackupService(repos)

export const dynamic = 'force-dynamic'

export default async function ConfiguracionPage() {
  await requireAdmin()
  const [horario, disponible, backupConfig, backupEstado, backups] = await Promise.all([
    sistema.obtenerHorario(),
    sistema.estaDisponible(),
    backup.obtenerConfig(),
    backup.obtenerEstado(),
    backup.listarBackups(),
  ])
  return (
    <ConfiguracionClient
      horario={horario}
      disponible={disponible}
      backupConfig={backupConfig}
      backupEstado={backupEstado}
      backups={backups}
    />
  )
}