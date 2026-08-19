'use client'

import { useCallback, useMemo, useState } from 'react'
import { FileText, FilePlus2, Loader2, Copy, Check, X, Upload, Radio, Send } from 'lucide-react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { crearDocumentoAction } from '@/server/actions/documentos.actions'
import { formatoBytes } from '@/lib/format'

type AreaOp = { id: string; name: string; sigla: string; active: boolean }
type DestinoOp = { id: string; name: string; areaName: string | null }

interface Creado {
  id: string
  nroCompleto: string
  numero: number
  year: number
  tipo: 'ci' | 'of'
  referencia: string
  fechaDocumento: string
}

export function DocumentoForm({
  areasEmitibles,
  areaInicial,
  destinatarios,
  maxFiles,
  maxSizeMB,
}: {
  areasEmitibles: AreaOp[]
  areaInicial: string | null
  destinatarios: DestinoOp[]
  maxFiles: number
  maxSizeMB: number
}) {
  const [tipo, setTipo] = useState<'ci' | 'of'>('ci')
  const [areaId, setAreaId] = useState<string>(areaInicial ? String(areaInicial) : areasEmitibles[0]?.id ? String(areasEmitibles[0].id) : '')
  const [referencia, setReferencia] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [modoDestino, setModoDestino] = useState<'usuario' | 'texto'>('usuario')
  const [destinatarioUsuario, setDestinatarioUsuario] = useState(destinatarios[0] ? String(destinatarios[0].id) : '')
  const [destinatarioTexto, setDestinatarioTexto] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [files, setFiles] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [creado, setCreado] = useState<Creado | null>(null)
  const [copiado, setCopiado] = useState(false)

  const maxBytes = maxSizeMB * 1024 * 1024

  const onDrop = useCallback(
    (aceptados: File[], rechazados: FileRejection[]) => {
      for (const r of rechazados) {
        const code = r.errors[0]?.code
        if (code === 'file-too-large') toast.error(`${r.file.name}: supera el máximo de ${maxSizeMB} MB.`)
        else if (code === 'too-many-files') toast.error(`Máximo ${maxFiles} archivos.`)
        else if (code === 'file-invalid-type') toast.error(`${r.file.name}: tipo de archivo no permitido.`)
        else toast.error(`${r.file.name}: ${r.errors[0]?.message ?? 'error'}`)
      }
      setFiles((prev) => [...prev, ...aceptados].slice(0, maxFiles))
    },
    [maxFiles, maxSizeMB],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles,
    maxSize: maxBytes,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
  })

  const confirmarDestino = useMemo(() => {
    if (modoDestino === 'usuario') return destinatarios.find((d) => String(d.id) === destinatarioUsuario)?.name ?? ''
    return destinatarioTexto.trim()
  }, [modoDestino, destinatarioUsuario, destinatarioTexto, destinatarios])

  const submit = async () => {
    if (!referencia.trim()) return toast.error('Indica la referencia.')
    if (!confirmarDestino) return toast.error('Indica el destino.')
    if (!areaId) return toast.error('Selecciona un área emisora.')

    setEnviando(true)
    const res = await crearDocumentoAction({
      areaId,
      tipo,
      referencia,
      descripcion: descripcion || null,
      destinatarioUserId: modoDestino === 'usuario' && destinatarioUsuario ? destinatarioUsuario : null,
      destinatarioTexto: modoDestino === 'texto' ? destinatarioTexto : null,
      fechaDocumento: fecha,
      archivos: files,
    })
    setEnviando(false)
    if (res.ok) {
      setCreado(res.data)
    } else {
      toast.error(res.error)
    }
  }

  const copiar = async () => {
    if (!creado) return
    try {
      await navigator.clipboard.writeText(creado.nroCompleto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      toast.error('No se pudo copiar.')
    }
  }

  const limpiar = () => {
    setReferencia('')
    setDescripcion('')
    setDestinatarioTexto('')
    setDestinatarioUsuario(destinatarios[0] ? String(destinatarios[0].id) : '')
    setFiles([])
    setFecha(new Date().toISOString().slice(0, 10))
    setCreado(null)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Registro de documento</h2>
        <p className="text-sm text-muted-foreground">
          El número se asigna automáticamente al guardar según la secuencia del área y año.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setTipo('ci')}
          className={cn(
            'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
            tipo === 'ci' ? 'border-primary bg-primary/5 glow-box' : 'hover:border-primary/40',
          )}
        >
          <Radio className={cn('h-5 w-5', tipo === 'ci' ? 'text-primary' : 'text-muted-foreground')} />
          <div>
            <div className="font-medium">Comunicación Interna</div>
            <div className="text-xs text-muted-foreground">Número SIGLA-CI-000/AÑO</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setTipo('of')}
          className={cn(
            'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
            tipo === 'of' ? 'border-primary bg-primary/5 glow-box' : 'hover:border-primary/40',
          )}
        >
          <Send className={cn('h-5 w-5', tipo === 'of' ? 'text-primary' : 'text-muted-foreground')} />
          <div>
            <div className="font-medium">Oficio Externo</div>
            <div className="text-xs text-muted-foreground">Número SIGLA-OF-000/AÑO</div>
          </div>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Área emisora</Label>
          <Select value={areaId} onValueChange={setAreaId} disabled={areasEmitibles.length <= 1 && areaInicial != null}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el área" />
            </SelectTrigger>
            <SelectContent>
              {areasEmitibles.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name} ({a.sigla})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha del documento</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Referencia {`(asunto resumido)`}</Label>
        <Input
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          placeholder="Ej: Remisión de planos topográficos de la zona norte"
        />
      </div>
      <div className="space-y-2">
        <Label>Descripción (opcional)</Label>
        <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} />
      </div>

      <div className="space-y-3">
        <Label>Destino</Label>
        <div className="flex gap-2">
          <Button variant={modoDestino === 'usuario' ? 'default' : 'outline'} size="sm" onClick={() => setModoDestino('usuario')} type="button">
            Usuario interno
          </Button>
          <Button variant={modoDestino === 'texto' ? 'default' : 'outline'} size="sm" onClick={() => setModoDestino('texto')} type="button">
            Texto libre
          </Button>
        </div>
        {modoDestino === 'usuario' ? (
          <Select value={destinatarioUsuario} onValueChange={setDestinatarioUsuario}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un usuario" />
            </SelectTrigger>
            <SelectContent>
              {destinatarios.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                  {d.areaName ? ` · ${d.areaName}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={destinatarioTexto}
            onChange={(e) => setDestinatarioTexto(e.target.value)}
            placeholder="Ej: Federación de Juntas Vecinales de la Zona 3"
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>Archivos adjuntos (opcional, máx. {maxFiles})</Label>
        <div
          {...getRootProps()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors',
            isDragActive ? 'border-primary bg-primary/5' : 'hover:border-primary/50',
          )}
        >
          <input {...getInputProps()} />
          <Upload className={cn('h-6 w-6', isDragActive ? 'text-primary' : 'text-muted-foreground')} />
          {isDragActive ? (
            <p className="text-sm text-primary">Suelta los archivos aquí</p>
          ) : (
            <>
              <p className="text-sm">
                Arrastra y suelta archivos, o <span className="text-primary underline">haz clic para elegir</span>
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, JPG, PNG, WEBP, GIF, DOC, DOCX · máx. {maxSizeMB} MB por archivo
              </p>
            </>
          )}
        </div>
        {files.length > 0 && (
          <ul className="space-y-1.5">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground">{formatoBytes(f.size)}</span>
                <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} aria-label="Quitar archivo">
                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={limpiar} disabled={enviando}>
          Limpiar
        </Button>
        <Button onClick={submit} disabled={enviando} className="gap-2">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
          {enviando ? 'Asignando número...' : 'Guardar y numerar'}
        </Button>
      </div>

      <Dialog open={!!creado} onOpenChange={(o) => !o && limpiar()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline" className="text-primary">
                <Check className="h-3.5 w-3.5" />
                Registrado
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {creado && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                El documento quedó registrado con el siguiente número oficial:
              </p>
              <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-6 glow-box">
                <span className="font-mono text-3xl font-bold tracking-wide text-neon">{creado.nroCompleto}</span>
                <Button variant="outline" size="icon" onClick={copiar} title="Copiar número">
                  {copiado ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <dl className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                <div className="flex justify-between gap-2"><dt>Referencia</dt><dd className="text-right text-foreground">{creado.referencia}</dd></div>
                <div className="flex justify-between gap-2"><dt>Fecha</dt><dd className="text-right text-foreground">{new Date(creado.fechaDocumento).toLocaleDateString('es-BO')}</dd></div>
              </dl>
              <p className="text-xs text-muted-foreground">Prepara el documento base usando el número copiado como referencia del cargo.</p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={limpiar}>Registrar otro documento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}