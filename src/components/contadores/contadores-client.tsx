'use client'

import { useState } from 'react'
import { RefreshCcw, RotateCcw, RotateCw, History } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { reiniciarContadorAction } from '@/server/actions/contadores.actions'
import { formatFecha } from '@/lib/format'

type EstadoArea = {
  area: { id: number; name: string; sigla: string; reiniciaAnualmente: boolean }
  ci: { id: number; ultimoNumero: number; ciclo: number; year: number | null } | null
  of: { id: number; ultimoNumero: number; ciclo: number; year: number | null } | null
}

type ResetRegistro = {
  id: number
  areaName: string
  areaSigla: string
  tipo: 'ci' | 'of'
  glosa: string
  numeroAnterior: number
  numeroNuevo: number
  realizadoPor: number
  createdAt: Date
}

export function ContadoresClient({
  esAdmin,
  estados,
  resets,
}: {
  esAdmin: boolean
  estados: EstadoArea[]
  resets: ResetRegistro[]
}) {
  const [reiniciando, setReiniciando] = useState<{ areaId: number; areaName: string; tipo: 'ci' | 'of' } | null>(null)
  const [glosa, setGlosa] = useState('')
  const [saving, setSaving] = useState(false)

  const reiniciar = async () => {
    if (!reiniciando) return
    if (!glosa.trim()) return toast.error('Indica la glosa (motivo).')
    const res = await reiniciarContadorAction({ areaId: reiniciando.areaId, tipo: reiniciando.tipo, glosa })
    setSaving(false)
    if (res.ok) {
      toast.success('Contador reiniciado y nuevo ciclo iniciado')
      setReiniciando(null)
      setGlosa('')
    } else {
      toast.error(res.error)
    }
  }

  const Celda = ({ c }: { c: EstadoArea['ci'] | EstadoArea['of'] }) => {
    if (!c) return <span className="text-muted-foreground">sin iniciar</span>
    const reiniciado = c.ciclo > 1
    return (
      <span className="font-mono text-xs">
        {String(c.ultimoNumero).padStart(3, '0')}
        {reiniciado && (
          <Badge variant="secondary" className="ml-1">
            ciclo {c.ciclo}
          </Badge>
        )}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCcw className="h-4 w-4" />
        Los números del formato se reinician con cada {`{AÑO}`} si el área lo activa. El reinicio manual abre un nuevo ciclo y queda auditado.
      </div>

      <Tabs defaultValue="estados">
        <TabsList>
          <TabsTrigger value="estados">Estados de numeración</TabsTrigger>
          <TabsTrigger value="historial">
            Historial de reinicios ({resets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="estados">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Área</TableHead>
                  <TableHead>CI</TableHead>
                  <TableHead>OF</TableHead>
                  <TableHead>Reinicio anual</TableHead>
                  {esAdmin && <TableHead className="text-right">Acción</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {estados.map((e) => (
                  <TableRow key={e.area.id}>
                    <TableCell className="max-w-64">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{e.area.name}</span>
                        <Badge variant="outline" className="shrink-0">{e.area.sigla}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Celda c={e.ci} />
                    </TableCell>
                    <TableCell>
                      <Celda c={e.of} />
                    </TableCell>
                    <TableCell>{e.area.reiniciaAnualmente ? 'Sí' : 'No'}</TableCell>
                    {esAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            title={`Reiniciar CI de ${e.area.name}`}
                            aria-label={`Reiniciar CI de ${e.area.name}`}
                            onClick={() => setReiniciando({ areaId: e.area.id, areaName: e.area.name, tipo: 'ci' })}
                          >
                            <RotateCcw />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            title={`Reiniciar OF de ${e.area.name}`}
                            aria-label={`Reiniciar OF de ${e.area.name}`}
                            onClick={() => setReiniciando({ areaId: e.area.id, areaName: e.area.name, tipo: 'of' })}
                          >
                            <RotateCw />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="historial">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Hacia</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resets.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatFecha(r.createdAt)}</TableCell>
                    <TableCell className="max-w-56">
                      <div className="flex min-w-0 items-baseline gap-1">
                        <span className="truncate">{r.areaName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">({r.areaSigla})</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.tipo.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{String(r.numeroAnterior).padStart(3, '0')}</TableCell>
                    <TableCell className="font-mono text-xs">{String(r.numeroNuevo).padStart(3, '0')}</TableCell>
                    <TableCell className="max-w-64 truncate text-xs text-muted-foreground">{r.glosa}</TableCell>
                  </TableRow>
                ))}
                {resets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                      Sin reinicios registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!reiniciando} onOpenChange={(o) => { if (!o) { setReiniciando(null); setGlosa('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Reiniciar numeración
            </DialogTitle>
          </DialogHeader>
          {reiniciando && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Reiniciar la secuencia{' '}
                <span className="font-semibold text-foreground">
                  {reiniciando.areaName} · {reiniciando.tipo.toUpperCase()}
                </span>{' '}
                pondrá <strong>0</strong> como siguiente número y abrirá un nuevo ciclo. Esta acción se audita.
              </p>
              <div className="space-y-2">
                <Label htmlFor="glosa">Glosa (motivo del reinicio) *</Label>
                <Textarea
                  id="glosa"
                  value={glosa}
                  onChange={(e) => setGlosa(e.target.value)}
                  rows={3}
                  placeholder="Ej: Se cerró la gestión 2026 y se inician nuevos números."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReiniciando(null); setGlosa('') }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={reiniciar} disabled={saving || glosa.trim().length < 3}>
              {saving ? 'Reiniciando...' : 'Confirmar reinicio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}