'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DatabaseBackup, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { guardarBackupConfigAction, hacerBackupNowAction } from '@/server/actions/backup.actions'
import type { BackupConfig } from '@/server/domain/backup'
import type { BackupEstado, BackupInfo } from '@/server/services/backup.service'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatFecha(iso: string | null): string {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleString()
}

export function BackupClient({
  config: inicial,
  estado,
  backups,
}: {
  config: BackupConfig
  estado: BackupEstado
  backups: BackupInfo[]
}) {
  const router = useRouter()
  const [config, setConfig] = useState<BackupConfig>(inicial)
  const [saving, setSaving] = useState(false)
  const [backingUp, setBackingUp] = useState(false)

  const guardar = async () => {
    setSaving(true)
    const res = await guardarBackupConfigAction(config)
    setSaving(false)
    if (res.ok) {
      toast.success('Configuración de respaldo guardada')
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  const hacerBackup = async () => {
    setBackingUp(true)
    const res = await hacerBackupNowAction()
    setBackingUp(false)
    if (res.ok) {
      toast.success(`Respaldo completado: ${res.data.archivo}`)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseBackup className="h-5 w-5" />
          Respaldo automático
        </CardTitle>
        <CardDescription>
          Genera un respaldo diario de la base de datos y los archivos subidos, a la hora configurada. También puedes ejecutar un respaldo manual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="font-medium">Respaldo diario</div>
            <div className="text-sm text-muted-foreground">
              {config.habilitado ? 'Se ejecutará todos los días' : 'Deshabilitado'}
            </div>
          </div>
          <Switch
            checked={config.habilitado}
            onCheckedChange={(v) => setConfig({ ...config, habilitado: v })}
            aria-label="Activar respaldo automático"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Hora del respaldo diario</Label>
            <Input
              type="time"
              value={config.hora}
              disabled={!config.habilitado}
              onChange={(e) => setConfig({ ...config, hora: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Retención (días)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={config.retentionDias}
              disabled={!config.habilitado}
              onChange={(e) =>
                setConfig({ ...config, retentionDias: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 p-4">
          <div className="space-y-1">
            <div className="text-sm">
              <span className="text-muted-foreground">Último respaldo:</span>{' '}
              <Badge variant={estado.ultimoOk ? 'default' : 'destructive'}>
                {formatFecha(estado.ultimoAt)}
              </Badge>
            </div>
            {estado.ultimoArchivo && (
              <div className="text-xs text-muted-foreground">
                {estado.ultimoArchivo} · {formatBytes(estado.ultimoTamano)}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={hacerBackup} disabled={backingUp}>
              {backingUp ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Respaldando...
                </>
              ) : (
                'Hacer backup ahora'
              )}
            </Button>
            <Button onClick={guardar} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </Button>
          </div>
        </div>

        {backups.length > 0 && (
          <div className="space-y-2">
            <Label>Respaldos guardados</Label>
            <div className="rounded-lg border divide-y">
              {backups.slice(0, 10).map((b) => (
                <div key={b.nombre} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{b.nombre}</span>
                  <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                    {formatBytes(b.tamano)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}