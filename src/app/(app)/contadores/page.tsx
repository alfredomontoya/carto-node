import { requireAdmin } from '@/server/auth/dal'
import { repos } from '@/server/repo/drizzle'
import { ContadorService } from '@/server/services/contador.service'
import { ContadoresClient } from '@/components/contadores/contadores-client'

const contadores = new ContadorService(repos)

export default async function ContadoresPage() {
  const admin = await requireAdmin()
  const [estados, audit] = await Promise.all([contadores.listaEstados(), (async () => {
    const resets = []
    const todas = await repos.contadores.list()
    for (const c of todas) {
      const r = await repos.audit.resetsByContador(c.id)
      for (const reset of r) {
        const area = await repos.areas.findById(c.areaOwnerId)
        resets.push({
          ...reset,
          areaName: area?.name ?? `Área #${c.areaOwnerId}`,
          areaSigla: area?.sigla ?? '?',
          tipo: c.tipo,
        })
      }
    }
    return resets.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
  })()])

  return (
    <ContadoresClient
      esAdmin={admin.role === 'admin'}
      estados={estados.map((e) => ({
        area: { id: e.area.id, name: e.area.name, sigla: e.area.sigla, reiniciaAnualmente: e.area.reiniciaAnualmente },
        ci: e.ci ? { id: e.ci.id, ultimoNumero: e.ci.ultimoNumero, ciclo: e.ci.ciclo, year: e.ci.year } : null,
        of: e.of ? { id: e.of.id, ultimoNumero: e.of.ultimoNumero, ciclo: e.of.ciclo, year: e.of.year } : null,
      }))}
      resets={audit.map((r) => ({
        id: r.id,
        areaName: (r as unknown as { areaName: string }).areaName,
        areaSigla: (r as unknown as { areaSigla: string }).areaSigla,
        tipo: (r as unknown as { tipo: 'ci' | 'of' }).tipo,
        glosa: r.glosa,
        numeroAnterior: r.numeroAnterior,
        numeroNuevo: r.numeroNuevo,
        realizadoPor: r.realizadoPor,
        createdAt: r.createdAt,
      }))}
    />
  )
}