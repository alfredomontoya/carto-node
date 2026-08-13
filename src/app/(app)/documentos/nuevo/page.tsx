import { requireModule } from '@/server/auth/dal'
import { repos } from '@/server/repo/drizzle'
import { DocumentoForm } from '@/components/documentos/documento-form'

export default async function NuevoDocumentoPage() {
  const actor = await requireModule('documentos')
  const [areas, usuarios] = await Promise.all([repos.areas.listAll(), repos.users.list()])

  const areasEmitibles =
    actor.role === 'admin'
      ? areas.map((a) => ({ id: a.id, name: a.name, sigla: a.sigla, active: a.active }))
      : areas
          .filter((a) => a.id === actor.asignacionActiva?.areaId && a.active)
          .map((a) => ({ id: a.id, name: a.name, sigla: a.sigla, active: a.active }))

  const destinatarios = (
    await Promise.all(
      usuarios.map(async (u) => {
        if (!u.active) return null
        const asig = await repos.users.activeUserAreaWithDetails(u.id)
        return {
          id: u.id,
          name: u.name,
          areaName: asig?.areaName ?? null,
        }
      }),
    )
  ).filter((x): x is { id: number; name: string; areaName: string | null } => x !== null)

  return (
    <DocumentoForm
      areasEmitibles={areasEmitibles}
      areaInicial={actor.role === 'admin' ? null : actor.asignacionActiva?.areaId ?? null}
      destinatarios={destinatarios}
      maxFiles={10}
      maxSizeMB={Number(process.env.MAX_UPLOAD_MB ?? 10)}
    />
  )
}