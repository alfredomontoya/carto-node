import { cache } from 'react'
import { FileText, Building2, Users, Mail, MailOpen } from 'lucide-react'
import { requireUser } from '@/server/auth/dal'
import { repos } from '@/server/repo/drizzle'
import { ContadorService } from '@/server/services/contador.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SIGLA_TIPO } from '@/server/domain/constants'
import { formatFecha } from '@/lib/format'

const contadores = new ContadorService(repos)

const getDatos = cache(async () => {
  const [documentos, ci, of, areas, usuarios, estados] = await Promise.all([
    repos.documentos.list({ q: undefined, page: 1, perPage: 1 }),
    repos.documentos.list({ tipo: 'ci', page: 1, perPage: 1 }),
    repos.documentos.list({ tipo: 'of', page: 1, perPage: 1 }),
    repos.areas.listAll(),
    repos.users.count(),
    contadores.listaEstados(),
  ])
  return { documentos, ci, of, areas, usuarios, estados }
})

export default async function DashboardPage() {
  await requireUser()
  const { documentos, ci, of, areas, usuarios, estados } = await getDatos()

  const recientes = await repos.documentos.list({ q: undefined, page: 1, perPage: 8 })

  const stats = [
    { label: 'Documentos', value: documentos.total, icon: FileText },
    { label: 'Comunicaciones internas', value: ci.total, icon: Mail },
    { label: 'Oficios externos', value: of.total, icon: MailOpen },
    { label: 'Áreas activas', value: areas.filter((a) => a.active).length, icon: Building2 },
    { label: 'Usuarios', value: usuarios, icon: Users },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neon">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos recientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recientes.items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.nroCompleto}</TableCell>
                    <TableCell>{d.areaSigla}</TableCell>
                    <TableCell className="max-w-40 truncate">{d.referencia}</TableCell>
                    <TableCell>{formatFecha(d.fechaDocumento)}</TableCell>
                  </TableRow>
                ))}
                {recientes.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                      Aún no hay documentos registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Numeración por área</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Área</TableHead>
                  <TableHead>CI</TableHead>
                  <TableHead>OF</TableHead>
                  <TableHead>Año</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estados.map((e) => (
                  <TableRow key={e.area.id}>
                    <TableCell>
                      <span className="font-medium">{e.area.name}</span>{' '}
                      <Badge variant="outline" className="ml-1 hidden sm:inline">
                        {e.area.sigla}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {e.ci ? (
                        <span className="font-mono text-xs">
                          {e.area.sigla}-{SIGLA_TIPO.ci}-{String(e.ci.ultimoNumero).padStart(3, '0')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {e.of ? (
                        <span className="font-mono text-xs">
                          {e.area.sigla}-{SIGLA_TIPO.of}-{String(e.of.ultimoNumero).padStart(3, '0')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>{e.area.reiniciaAnualmente ? new Date().getFullYear() : '·'}</TableCell>
                  </TableRow>
                ))}
                {estados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                      No hay áreas registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}