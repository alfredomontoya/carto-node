'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Folder, FolderOpen, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  crearAreaAction,
  actualizarAreaAction,
  eliminarAreaAction,
} from '@/server/actions/areas.actions'
import type { NodoArea } from '@/server/services/area.service'

interface AreaPlana {
  id: number
  name: string
  sigla: string
  parentId: number | null
  numeracionMode: 'propia' | 'hereda'
  reiniciaAnualmente: boolean
  active: boolean
  description: string | null
}

export function AreaTree({
  arbol,
  areas,
  esAdmin,
}: {
  arbol: NodoArea[]
  areas: AreaPlana[]
  esAdmin: boolean
}) {
  const [dialogo, setDialogo] = useState<{ abierto: boolean; area: AreaPlana | null; parentId: number | null }>({
    abierto: false,
    area: null,
    parentId: null,
  })

  const abrirCrear = (parentId: number | null) => setDialogo({ abierto: true, area: null, parentId })
  const abrirEditar = (area: AreaPlana) => setDialogo({ abierto: true, area, parentId: area.parentId })

  const onEliminar = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar el área "${name}"?`)) return
    const res = await eliminarAreaAction(id)
    if (res.ok) toast.success('Área eliminada')
    else toast.error(res.error)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => abrirCrear(null)} disabled={!esAdmin}>
          <Plus className="h-4 w-4" />
          Nueva área raíz
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {arbol.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No hay áreas registradas.</div>
        )}
        {arbol.map((nodo) => (
          <Nodo
            key={nodo.id}
            nodo={nodo}
            esAdmin={esAdmin}
            onCrear={abrirCrear}
            onEditar={abrirEditar}
            onEliminar={onEliminar}
            depth={0}
          />
        ))}
      </div>

      <AreaDialog
        key={dialogo.area?.id ?? dialogo.parentId ?? 'new'}
        opened={dialogo.abierto}
        onClose={() => setDialogo((d) => ({ ...d, abierto: false }))}
        area={dialogo.area}
        parentId={dialogo.parentId}
        areas={areas}
        esAdmin={esAdmin}
      />
    </div>
  )
}

function Nodo({
  nodo,
  esAdmin,
  onCrear,
  onEditar,
  onEliminar,
  depth,
}: {
  nodo: NodoArea
  esAdmin: boolean
  onCrear: (parentId: number | null) => void
  onEditar: (area: AreaPlana) => void
  onEliminar: (id: number, name: string) => Promise<void>
  depth: number
}) {
  const [abierto, setAbierto] = useState(true)
  const tieneHijos = nodo.hijos.length > 0

  return (
    <div>
      <div
        className="group flex items-center gap-2 border-b px-3 py-2 hover:bg-accent/40"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className={cn('text-muted-foreground', !tieneHijos && 'invisible')}
          aria-label={abierto ? 'Colapsar' : 'Expandir'}
        >
          {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {abierto ? <FolderOpen className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-primary" />}
        <span className="min-w-0 truncate font-medium">{nodo.name}</span>
        <Badge variant="outline">{nodo.sigla}</Badge>
        <Badge variant={nodo.numeracionMode === 'propia' ? 'default' : 'secondary'}>
          {nodo.numeracionMode === 'propia' ? 'numeración propia' : 'hereda'}
        </Badge>
        {nodo.reiniciaAnualmente && (
          <Badge variant="secondary" className="hidden sm:inline">
            reinicia año
          </Badge>
        )}
        {!nodo.active && <Badge variant="destructive">inactiva</Badge>}
        <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {esAdmin && (
            <Button variant="ghost" size="icon" onClick={() => onCrear(nodo.id)} title="Crear sub-área">
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {esAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditar({ id: nodo.id, name: nodo.name, sigla: nodo.sigla, parentId: nodo.parentId, numeracionMode: nodo.numeracionMode, reiniciaAnualmente: nodo.reiniciaAnualmente, active: nodo.active, description: nodo.description })}
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => onEliminar(nodo.id, nodo.name)} title="Eliminar" disabled={!esAdmin}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      {abierto &&
        nodo.hijos.map((h) => (
          <Nodo
            key={h.id}
            nodo={h}
            esAdmin={esAdmin}
            onCrear={onCrear}
            onEditar={onEditar}
            onEliminar={onEliminar}
            depth={depth + 1}
          />
        ))}
      {abierto && nodo.puestos.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 py-2" style={{ paddingLeft: `${depth * 20 + 44}px` }}>
          {nodo.puestos.map((p) => (
            <Badge key={p.id} variant="outline" className="gap-1 text-xs">
              <Building2 className="h-3 w-3" />
              {p.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function AreaDialog({
  opened,
  onClose,
  area,
  parentId,
  areas,
  esAdmin,
}: {
  opened: boolean
  onClose: () => void
  area: AreaPlana | null
  parentId: number | null
  areas: AreaPlana[]
  esAdmin: boolean
}) {
  const [name, setName] = useState(area?.name ?? '')
  const [sigla, setSigla] = useState(area?.sigla ?? '')
  const [description, setDescription] = useState(area?.description ?? '')
  const [parent, setParent] = useState<string>(area?.parentId ? String(area.parentId) : parentId ? String(parentId) : '')
  const [modo, setModo] = useState<'propia' | 'hereda'>(area?.numeracionMode ?? 'hereda')
  const [anual, setAnual] = useState(area?.reiniciaAnualmente ?? true)
  const [active, setActive] = useState(area?.active ?? true)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    const payload = {
      name,
      sigla,
      description: description || null,
      parentId: parent ? Number(parent) : null,
      numeracionMode: modo,
      reiniciaAnualmente: anual,
      active,
    }
    const res = area ? await actualizarAreaAction(area.id, payload) : await crearAreaAction(payload)
    setSaving(false)
    if (res.ok) {
      toast.success(area ? 'Área actualizada' : 'Área creada')
      onClose()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <Dialog open={opened} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{area ? 'Editar área' : 'Nueva área'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dirección de Operaciones..." />
            </div>
            <div className="space-y-2">
              <Label>Sigla</Label>
              <Input value={sigla} onChange={(e) => setSigla(e.target.value.toUpperCase())} placeholder="DOT" className="font-mono" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Área padre</Label>
            <Select value={parent} onValueChange={setParent}>
              <SelectTrigger>
                <SelectValue placeholder="Sin área padre (raíz)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">Sin área padre (raíz)</SelectItem>
                {areas
                  .filter((a) => a.id !== area?.id)
                  .map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name} ({a.sigla})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {esAdmin && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Numeración</Label>
                <Select
                  value={modo}
                  onValueChange={(v) => setModo(v as 'propia' | 'hereda')}
                  disabled={!esAdmin}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="propia">Propia (contador propio)</SelectItem>
                    <SelectItem value="hereda">Hereda del padre</SelectItem>
                  </SelectContent>
                </Select>
                {modo === 'hereda' && !parent && (
                  <p className="text-xs text-destructive">Sin área padre no puede heredar numeración.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Reinicio</Label>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Switch checked={anual} onCheckedChange={setAnual} />
                  <span className="text-sm">Cada año</span>
                </div>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Switch checked={active} onCheckedChange={setActive} />
                  <span className="text-sm">Activa</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || (modo === 'hereda' && !parent)}>
            {saving ? 'Guardando...' : area ? 'Guardar cambios' : 'Crear área'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}