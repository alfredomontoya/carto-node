import { requireModule } from '@/server/auth/dal'
import { repos } from '@/server/repo'
import { DocumentoService } from '@/server/services/documento.service'
import { DocumentosClient } from '@/components/documentos/documentos-client'

const documentoService = new DocumentoService(repos)
const PER = 12

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const actor = await requireModule('documentos')
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1) || 1)

  const filtros = {
    q: typeof params.q === 'string' ? params.q : undefined,
    tipo: (params.tipo === 'ci' || params.tipo === 'of' ? params.tipo : '') as 'ci' | 'of' | '',
    year: params.year ? Number(params.year) : ('') as number | '',
    areaId: params.areaId ? String(params.areaId) : undefined,
    soloMios: params.soloMios === '1',
  }

  const [resultado, areas] = await Promise.all([
    documentoService.listar(
      { id: actor.id, role: actor.role, areaId: actor.asignacionActiva?.areaId ?? null },
      { ...filtros, page, perPage: PER },
    ),
    repos.areas.listAll(),
  ])

  const anios = await repos.documentos.list({ page: 1, perPage: 1 }).then(() => {
    return [new Date().getFullYear(), new Date().getFullYear() - 1]
  })

  return (
    <DocumentosClient
      items={resultado.items}
      total={resultado.total}
      page={page}
      perPage={PER}
      filtros={filtros}
      areas={areas.map((a) => ({ id: a.id, name: a.name, sigla: a.sigla }))}
      anios={anios}
      esGuest={actor.role === 'guest'}
    />
  )
}