import Link from 'next/link'
import { ArrowRight, Clock, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getCurrentUser } from '@/server/auth/dal'
import { DIAS_LABEL } from '@/server/domain/constants'
import { repos } from '@/server/repo'
import { SistemaService } from '@/server/services/sistema.service'

const sistema = new SistemaService(repos)

export const dynamic = 'force-dynamic'

export default async function FueraHorarioPage() {
  const [usuario, horario] = await Promise.all([getCurrentUser(), sistema.obtenerHorario()])
  const esAdmin = usuario?.role === 'admin'
  const diasNombres = horario.dias.map((d) => DIAS_LABEL[d])

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardContent className="space-y-6 px-6 py-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <WifiOff className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <Badge variant="destructive">Sistema fuera de línea</Badge>
            <h1 className="text-2xl font-semibold tracking-tight">No estamos disponibles ahora</h1>
            <p className="text-sm text-muted-foreground">
              El acceso al sistema está limitado a un horario de atención configurado por el administrador.
            </p>
          </div>

          {horario.habilitado && (
            <div className="rounded-lg border bg-muted/50 p-4 text-left text-sm">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Clock className="h-4 w-4" />
                Próximo horario de atención
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">
                  {horario.horaInicio} – {horario.horaFin}
                </Badge>
                <span className="text-muted-foreground">·</span>
                {diasNombres.map((d) => (
                  <Badge key={d} variant="outline">
                    {d}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {esAdmin ? (
            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link href="/configuracion">
                  Ir a Configuración
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                Mientras el sistema está fuera de línea, solo tienes acceso a Configuración.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Vuelve dentro del horario configurado para ingresar al sistema.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}