import { validationError } from '@/server/domain/errors'

export const BACKUP_KEY = 'backup_config'
export const BACKUP_ESTADO_KEY = 'backup_estado'

export const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export interface BackupConfig {
  habilitado: boolean
  hora: string
  retentionDias: number
}

export const BACKUP_CONFIG_DEFAULT: BackupConfig = {
  habilitado: false,
  hora: '03:00',
  retentionDias: 7,
}

export function validarBackupConfig(datos: BackupConfig): void {
  const fieldErrors: Record<string, string[]> = {}
  if (!HORA_RE.test(datos.hora)) {
    fieldErrors.hora = ['Formato inválido (usa HH:mm).']
  }
  if (!Number.isInteger(datos.retentionDias) || datos.retentionDias < 1 || datos.retentionDias > 365) {
    fieldErrors.retentionDias = ['Debe ser un número entre 1 y 365.']
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw validationError(fieldErrors, Object.values(fieldErrors).flat().join(' '))
  }
}

export function parseBackupConfig(valor: string | null): BackupConfig {
  if (!valor) return { ...BACKUP_CONFIG_DEFAULT }
  try {
    return { ...BACKUP_CONFIG_DEFAULT, ...(JSON.parse(valor) as Partial<BackupConfig>) }
  } catch {
    return { ...BACKUP_CONFIG_DEFAULT }
  }
}