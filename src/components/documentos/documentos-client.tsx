'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Trash2, ArrowLeft, ArrowRight, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SIGLA_TIPO, type TipoDocumento } from '@/server/domain/constants'
import { eliminarDocumentoAction } from '@/server/actions/documentos.actions'
import { formatFecha } from '@/lib/format'

type Col = {
  id: number
  nroCompleto: string
  referencia: string
  tipo: TipoDocumento
  year: number
  numero: number
  fechaDocumento: Date | string
  areaSigla: string
  areaName: string
  creadorName: string
  destinatarioName: string | null
  destinatarioTexto: string | null
  creadoPor: number
  files?: { id: number; nombreOriginal: string; mime: string; size: number }[]
}

export function DocumentosClient({
  items,
  total,
  page,
  perPage,
  filtros,
  areas,
  anios,
  esGuest,
}: {
  items: Col[]
  total: number
  page: number
  perPage: number
  filtros: { q?: string; tipo: TipoDocumento | ''; year: number | ''; areaId?: number; soloMios: boolean }
  areas: { id: number; name: string; sigla: string }[]
  anios: number[]
  esGuest: boolean
}) {
  const router = useRouter()
  const [q, setQ] = useState(filtros.q ?? '')

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const ir = (path: string) => router.push(path)
  const del = async (id: number) => {
    if (!confirm('¿Eliminar este documento?') ) return
    const res = await eliminarDocumentoAction(id)
    if (res.ok) {
      toast.success('Documento eliminado')
      router.refresh()
    } else toast.error(res.error)
  }

  const cambiar = (patch: Record<string, string>) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    sp.set('tipo', (patch.tipo ?? filtros.tipo) || '')
    sp.set('year', (patch.year ?? filtros.year) ? String(patch.year ?? filtros.year) : '')
    if (patch.areaId !== undefined) sp.set('areaId', patch.areaId || '')
    else if (filtros.areaId) sp.set('areaId', String(filtros.areaId))
    sp.set('soloMios', patch.soloMios !== undefined ? patch.soloMios : filtros.soloMios ? '1' : '0')
    if (page > 1 || patch.page) sp.set('page', patch.page ?? String(Math.max(1, page)))
    router.push(`/documentos?${sp.toString()}`)
  }

  const searches = (e: React.FormEvent) => {
    e.preventDefault()
    cambiar({ q })
  }

  const destino = (d: Col) => {
    if (d.destinatarioName) return <span>{d.destinatarioName}</span>
    return <span className="text-muted-foreground">{d.destinatarioTexto}</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <form onSubmit={searches} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por referencia o número..." className="pl-8" />
          </div>
          <Button type="submit" variant="secondary" size="icon" aria-label="Buscar">
            <Search className="h-4 w-4" />
          </Button>
        </form>
        {!esGuest && (
          <Button size="sm" onClick={() => ir('/documentos/nuevo')}>
            <Plus className="h-4 w-4" />
            Nuevo documento
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filtros.tipo} onValueChange={(v) => cambiar({ tipo: v })}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ci">Comunicación interna</SelectItem>
            <SelectItem value="of">Oficio externo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtros.areaId ? String(filtros.areaId) : ''} onValueChange={(v) => cambiar({ areaId: v })}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtros.year ? String(filtros.year) : ''} onValueChange={(v) => cambiar({ year: v })}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            {[...new Set(anios)].map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filtros.soloMios ? 'default' : 'outline'}
          size="sm"
          onClick={() => cambiar({ soloMios: filtros.soloMios ? '0' : '1' })}
        >
          Solo míos
        </Button>

        <span className="ml-auto text-sm text-muted-foreground">{total} resultado{total === 1 ? '' : 's'}</span>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs font-medium">{d.nroCompleto}</TableCell>
                <TableCell>
                  <Badge variant={d.tipo === 'ci' ? 'secondary' : 'default'}>{SIGLA_TIPO[d.tipo]}</Badge>
                </TableCell>
                <TableCell className="max-w-52 truncate">{d.referencia}</TableCell>
                <TableCell>
                  {d.areaSigla}
                  <span className="ml-1 text-xs text-muted-foreground">{d.areaName}</span>
                </TableCell>
                <TableCell className="max-w-40 truncate">{destino(d)}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatFecha(d.fechaDocumento)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Ver" onClick={() => ir(`/documentos/${d.id}`)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {!esGuest && (
                      <Button variant="ghost" size="icon" title="Eliminar" onClick={() => del(d.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No hay documentos que coincidan con los filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => cambiar({ page: String(page - 1) })}>
            <ArrowLeft className="h-4 w-4" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => cambiar({ page: String(page + 1) })}>
            Siguiente <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}