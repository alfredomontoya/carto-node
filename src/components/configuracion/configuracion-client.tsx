'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { DIAS_LABEL, type HorarioDisponibilidad } from '@/server/domain/constants'
import { guardarHorarioAction } from '@/server/actions/settings.actions'
import type { BackupConfig } from '@/server/domain/backup'
import type { BackupEstado, BackupInfo } from '@/server/services/backup.service'
import { BackupClient } from '@/components/configuracion/backup-client'

export function ConfiguracionClient({
  horario: inicial,
  disponible,
  backupConfig,
  backupEstado,
  backups,
}: {
  horario: HorarioDisponibilidad
  disponible: boolean
  backupConfig: BackupConfig
  backupEstado: BackupEstado
  backups: BackupInfo[]
}) {
  const router = useRouter()
  const [horario, setHorario] = useState<HorarioDisponibilidad>(inicial)
  const [saving, setSaving] = useState(false)

  const toggleDia = (d: number) => {
    setHorario((h) => ({
      ...h,
      dias: h.dias.includes(d) ? h.dias.filter((x) => x !== d) : [...h.dias, d].sort((a, b) => a - b),
    }))
  }

  const guardar = async () => {
    setSaving(true)
    const res = await guardarHorarioAction(horario)
    setSaving(false)
    if (res.ok) {
      toast.success('Horario de disponibilidad guardado')
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Horario de disponibilidad
        </CardTitle>
        <CardDescription>
          Define en qué días y horas el sistema está en línea. Fuera de este horario, los usuarios no podrán ingresar ni usar la aplicación.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="font-medium">Sistema en línea</div>
            <div className="text-sm text-muted-foreground">
              {horario.habilitado
                ? 'Se respeta el horario configurado'
                : 'Sin restricción de horario (siempre en línea)'}
            </div>
          </div>
          <Switch
            checked={horario.habilitado}
            onCheckedChange={(v) => setHorario({ ...horario, habilitado: v })}
            aria-label="Activar horario de disponibilidad"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Hora de inicio</Label>
            <Input
              type="time"
              value={horario.horaInicio}
              disabled={!horario.habilitado}
              onChange={(e) => setHorario({ ...horario, horaInicio: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Hora de fin</Label>
            <Input
              type="time"
              value={horario.horaFin}
              disabled={!horario.habilitado}
              onChange={(e) => setHorario({ ...horario, horaFin: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Días en línea</Label>
          <div className="flex flex-wrap gap-2">
            {DIAS_LABEL.map((label, d) => (
              <button
                key={label}
                type="button"
                disabled={!horario.habilitado}
                onClick={() => toggleDia(d)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
                  horario.dias.includes(d)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:border-primary/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 p-4">
          <Badge variant={disponible ? 'default' : 'destructive'}>
            {disponible ? 'El sistema está disponible ahora' : 'Fuera del horario ahora'}
          </Badge>
          <Button onClick={guardar} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar horario'}
          </Button>
        </div>
      </CardContent>
    </Card>
    <BackupClient config={backupConfig} estado={backupEstado} backups={backups} />
    </div>
  )
}
