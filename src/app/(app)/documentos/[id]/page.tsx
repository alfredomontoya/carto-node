import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Download, Copy } from 'lucide-react'
import { requireModule } from '@/server/auth/dal'
import { repos } from '@/server/repo'
import { DocumentoService } from '@/server/services/documento.service'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ETIQUETA_TIPO, SIGLA_TIPO } from '@/server/domain/constants'
import { formatFecha, formatoBytes } from '@/lib/format'

const documentoService = new DocumentoService(repos)

export default async function DocumentoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireModule('documentos')
  const { id } = await params
  const data = await documentoService.obtener(id).catch(() => null)
  if (!data) notFound()

  const { documento, areaSigla, areaName, creadorName, destinatarioName, files } = data

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/documentos">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </Button>
        <Badge variant={documento.tipo === 'of' ? 'default' : 'secondary'}>{SIGLA_TIPO[documento.tipo]}</Badge>
        <span className="text-xs text-muted-foreground">{ETIQUETA_TIPO[documento.tipo]}</span>
      </div>

      <Card className="neon-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="font-mono text-2xl text-neon">{documento.nroCompleto}</CardTitle>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigator.clipboard.writeText(documento.nroCompleto)}>
              <Copy className="h-4 w-4" /> Copiar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Referencia</dt>
              <dd className="font-medium">{documento.referencia}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fecha</dt>
              <dd>{formatFecha(documento.fechaDocumento)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Área emisora</dt>
              <dd>
                {areaSigla} — {areaName}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Destino</dt>
              <dd>{destinatarioName ?? documento.destinatarioTexto ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Creado por</dt>
              <dd>{creadorName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Número</dt>
              <dd className="font-mono">
                {String(documento.numero).padStart(3, '0')}/{documento.year}
              </dd>
            </div>
          </dl>
          {documento.descripcion && (
            <>
              <Separator />
              <div>
                <dt className="mb-1 text-sm text-muted-foreground">Descripción</dt>
                <dd className="whitespace-pre-wrap text-sm">{documento.descripcion}</dd>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {actor.role !== 'guest' && files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Archivos adjuntos ({files.length})</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="min-w-0 flex-1 truncate">{f.nombreOriginal}</span>
                <span className="text-xs text-muted-foreground">{formatoBytes(f.size)}</span>
                <Button variant="ghost" size="sm" className="gap-1" asChild>
                  <a href={`/api/documents/${documento.id}/files/${f.id}`} download={f.nombreOriginal}>
                    <Download className="h-4 w-4" /> Descargar
                  </a>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}