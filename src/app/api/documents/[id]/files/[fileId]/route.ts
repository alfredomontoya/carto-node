import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/server/auth/dal'
import { repos } from '@/server/repo'
import { obtenerStorage } from '@/server/services/storage.service'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const actor = await getCurrentUser()
  if (!actor || actor.role === 'guest') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { id, fileId } = await params
  const documento = await repos.documentos.findById(Number(id))
  if (!documento || documento.estado === 'anulado') {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  const file = await repos.files.findById(Number(fileId))
  if (!file || file.documentoId !== documento.id) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const data = await obtenerStorage().leer(file.path)
  if (!data) {
    return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': file.mime,
      'Content-Length': String(file.size),
      'Content-Disposition': `attachment; filename="${file.nombreOriginal.replace(/"/g, '')}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}