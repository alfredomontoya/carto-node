'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, KeyRound, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ROLES, MODULOS } from '@/server/domain/constants'
import {
  crearUsuarioAction,
  actualizarUsuarioAction,
  resetPasswordAction,
  eliminarUsuarioAction,
} from '@/server/actions/usuarios.actions'

interface UsuarioRow {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'guest'
  active: boolean
  moduleAssignments: { module: string }[]
  asignacionActiva: {
    areaId: string | null
    areaName: string | null
    areaSigla: string | null
    puestoId: string | null
    puestoName: string | null
  } | null
}

interface FormState {
  id: string | null
  name: string
  email: string
  password: string
  role: string
  active: boolean
  modules: string[]
  areaId: string
  puestoId: string
}

const TRANSLATE: Record<string, string> = {
  admin: 'Administrador',
  user: 'Usuario',
  guest: 'Invitado',
  areas: 'Áreas',
  documentos: 'Documentos',
  contadores: 'Numeración',
  usuarios: 'Usuarios',
  reportes: 'Reportes',
}

export function UsuariosClient({
  esAdmin,
  usuarioActivoId,
  dominio,
  usuarios,
  areas,
  puestosPorArea,
}: {
  esAdmin: boolean
  usuarioActivoId: string
  dominio: string
  usuarios: UsuarioRow[]
  areas: { id: string; name: string; sigla: string; active: boolean }[]
  puestosPorArea: Record<string, { id: string; name: string; sigla: string }[]>
}) {
  const [editando, setEditando] = useState<FormState | null>(null)
  const [reseteando, setReseteando] = useState<{ id: string; name: string } | null>(null)
  const [nuevaPass, setNuevaPass] = useState('')
  const [saving, setSaving] = useState(false)

  const inicial = (id: string): FormState | null => {
    const u = usuarios.find((x) => x.id === id)
    if (!u) return null
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      active: u.active,
      modules: u.moduleAssignments.map((m) => m.module),
      areaId: u.asignacionActiva?.areaId ? String(u.asignacionActiva.areaId) : 'none',
      puestoId: u.asignacionActiva?.puestoId ? String(u.asignacionActiva.puestoId) : 'none',
    }
  }

  const submit = async () => {
    if (!editando) return
    setSaving(true)
    const payload = {
      name: editando.name,
      email: editando.email,
      password: editando.password || undefined,
      role: editando.role as 'admin' | 'user' | 'guest',
      active: editando.active,
      modules: editando.modules,
      areaId: editando.areaId === 'none' ? null : editando.areaId,
      puestoId: editando.puestoId === 'none' ? null : editando.puestoId,
    }
    const res = editando.id ? await actualizarUsuarioAction(editando.id, payload) : await crearUsuarioAction(payload)
    setSaving(false)
    if (res.ok) {
      toast.success(editando.id ? 'Usuario actualizado' : 'Usuario creado')
      setEditando(null)
    } else {
      toast.error(res.error)
    }
  }

  const resetPass = async () => {
    if (!reseteando) return
    const res = await resetPasswordAction(reseteando.id, nuevaPass)
    if (res.ok) {
      toast.success('Contraseña actualizada')
      setReseteando(null)
      setNuevaPass('')
    } else {
      toast.error(res.error)
    }
  }

  const eliminar = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar al usuario "${name}"?`)) return
    const res = await eliminarUsuarioAction(id)
    if (res.ok) toast.success('Usuario eliminado')
    else toast.error(res.error)
  }

  const toggleModule = (m: string) => {
    if (!editando) return
    setEditando({ ...editando, modules: editando.modules.includes(m) ? editando.modules.filter((x) => x !== m) : [...editando.modules, m] })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {usuarios.length} usuarios registrados. El correo se genera automáticamente como{' '}
          <span className="font-medium">usuario@{dominio}</span> y el acceso es con nombre de usuario y contraseña.
        </p>
        {esAdmin && (
          <Button size="sm" onClick={() => setEditando({ id: null, name: '', email: '', password: '', role: 'user', active: true, modules: ['documentos'], areaId: 'none', puestoId: 'none' })}>
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Área activa</TableHead>
              <TableHead>Módulos</TableHead>
              <TableHead>Estado</TableHead>
              {esAdmin && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="max-w-56">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback>{u.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{u.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === 'admin' ? 'default' : u.role === 'user' ? 'secondary' : 'outline'}>
                    {TRANSLATE[u.role] ?? u.role}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-56">
                  {u.asignacionActiva?.areaName ? (
                    <div className="flex min-w-0 items-center gap-1 text-sm">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{u.asignacionActiva.areaName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">· {u.asignacionActiva.puestoName ?? '—'}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Sin asignar</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.moduleAssignments.map((m) => (
                      <Badge key={m.module} variant="outline">
                        {TRANSLATE[m.module] ?? m.module}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.active ? 'default' : 'destructive'}>{u.active ? 'Activo' : 'Inactivo'}</Badge>
                </TableCell>
                {esAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Restablecer contraseña" onClick={() => setReseteando({ id: u.id, name: u.name })}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditando(inicial(u.id))}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Eliminar" onClick={() => eliminar(u.id, u.name)} disabled={u.id === usuarioActivoId}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editando?.id ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          </DialogHeader>
          {editando && (
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Nombre completo</Label>
                <Input value={editando.name} onChange={(e) => setEditando({ ...editando, name: e.target.value })} placeholder="Ej. Amontoya" />
              </div>
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                {editando.id ? (
                  <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">{editando.email}</div>
                ) : (
                  <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Se generará automáticamente: <span className="font-medium text-foreground">usuario@{dominio}</span>
                  </div>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={editando.role} onValueChange={(v) => setEditando({ ...editando, role: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {TRANSLATE[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{editando.id ? 'Nueva contraseña (opcional)' : 'Contraseña'}</Label>
                  <Input value={editando.password} onChange={(e) => setEditando({ ...editando, password: e.target.value })} type="password" placeholder={editando.id ? 'Dejar vacío mantiene la actual' : 'Mín. 6 caracteres'} />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Área</Label>
                  <Select value={editando.areaId} onValueChange={(v) => setEditando({ ...editando, areaId: v, puestoId: 'none' })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin área" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin área</SelectItem>
                      {areas.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name} ({a.sigla})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Puesto</Label>
                  <Select value={editando.puestoId} onValueChange={(v) => setEditando({ ...editando, puestoId: v })} disabled={editando.areaId === 'none'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin puesto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin puesto</SelectItem>
                      {(puestosPorArea[editando.areaId === 'none' ? 'none' : editando.areaId] ?? []).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editando.role !== 'admin' && (
                <div className="space-y-2">
                  <Label>Módulos asignados</Label>
                  <div className="flex flex-wrap gap-2">
                    {MODULOS.filter((m) => m === 'areas' || m === 'documentos').map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleModule(m)}
                        className={`rounded-full border px-3 py-1 text-sm transition-colors ${editando.modules.includes(m) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:border-primary/40'}`}
                      >
                        {TRANSLATE[m]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={editando.active} onCheckedChange={(v) => setEditando({ ...editando, active: v })} />
                <Label>Usuario activo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving || !editando?.name}>
              {saving ? 'Guardando...' : editando?.id ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reseteando} onOpenChange={(o) => !o && setReseteando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Nueva contraseña para <span className="font-medium text-foreground">{reseteando?.name}</span>. Las sesiones activas del usuario se cerrarán.
            </p>
            <Input
              value={nuevaPass}
              onChange={(e) => setNuevaPass(e.target.value)}
              type="password"
              placeholder="Mín. 6 caracteres"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReseteando(null)}>
              Cancelar
            </Button>
            <Button onClick={resetPass} disabled={nuevaPass.length < 6}>
              Restablecer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}