import { requireModule } from '@/server/auth/dal'
import { repos } from '@/server/repo'
import { DOMINIO_CORREO } from '@/server/domain/identidad'
import { UsuarioService } from '@/server/services/usuario.service'
import { UsuariosClient } from '@/components/usuarios/usuarios-client'

const usuarios = new UsuarioService(repos)

export default async function UsuariosPage() {
  const actor = await requireModule('usuarios')
  const [lista, areas] = await Promise.all([usuarios.listar(), repos.areas.listAll()])

  const puestosPorArea: Record<string, { id: string; name: string; sigla: string }[]> = {}
  for (const a of areas) {
    const puestos = await repos.areas.puestosByArea(a.id)
    puestosPorArea[a.id] = puestos.map((p) => ({ id: p.id, name: p.name, sigla: p.sigla }))
  }

  return (
    <UsuariosClient
      esAdmin={actor.role === 'admin'}
      usuarioActivoId={actor.id}
      dominio={DOMINIO_CORREO}
      usuarios={lista}
      areas={areas.map((a) => ({ id: a.id, name: a.name, sigla: a.sigla, active: a.active }))}
      puestosPorArea={puestosPorArea}
    />
  )
}