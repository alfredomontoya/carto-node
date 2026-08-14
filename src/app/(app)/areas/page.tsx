import { requireModule } from '@/server/auth/dal'
import { repos } from '@/server/repo'
import { AreaService } from '@/server/services/area.service'
import { AreaTree } from '@/components/areas/area-tree'

const areaService = new AreaService(repos)

export default async function AreasPage() {
  const actor = await requireModule('areas')
  const [arbol, planas] = await Promise.all([areaService.obtenerArbol(), repos.areas.listAll()])

  const areasPlanas = planas.map((a) => ({
    id: a.id,
    name: a.name,
    sigla: a.sigla,
    parentId: a.parentId,
    numeracionMode: a.numeracionMode,
    reiniciaAnualmente: a.reiniciaAnualmente,
    active: a.active,
    description: a.description,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Organigrama de áreas</h2>
          <p className="text-sm text-muted-foreground">
            Cada área hereda puestos por defecto y puede definir su numeración propia o heredada.
          </p>
        </div>
      </div>
      <AreaTree arbol={arbol} areas={areasPlanas} esAdmin={actor.role === 'admin'} />
    </div>
  )
}