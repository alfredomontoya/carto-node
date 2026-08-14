import bcrypt from 'bcryptjs'
import { faker } from '@faker-js/faker/locale/es'
import { repos } from '@/server/repo'
import { AreaService } from '@/server/services/area.service'
import { DocumentoService } from '@/server/services/documento.service'
import { ETIQUETA_TIPO } from '@/server/domain/constants'
import { DOMINIO_CORREO, nombreAUsuario } from '@/server/domain/identidad'

const areaService = new AreaService(repos)
const docService = new DocumentoService(repos)

faker.seed(2026)

type AreaDef = {
  name: string
  sigla: string
  parent: string | null
  modo: 'propia' | 'hereda'
  anual: boolean
}

const ARBOL: AreaDef[] = [
  { name: 'Secretaría Municipal de Planificación del Desarrollo', sigla: 'SEMPLADYMA', parent: null, modo: 'propia', anual: true },
  { name: 'Dirección de Ordenamiento Territorial', sigla: 'DOT', parent: 'SEMPLADYMA', modo: 'propia', anual: true },
  { name: 'Dirección de Regularización Urbana', sigla: 'DRU', parent: 'SEMPLADYMA', modo: 'propia', anual: true },
  { name: 'Sistema de Información y Soporte', sigla: 'SIS', parent: 'SEMPLADYMA', modo: 'propia', anual: true },
  { name: 'Unidad de Cartografía', sigla: 'CARTOGRAFIA', parent: 'DOT', modo: 'hereda', anual: true },
  { name: 'Unidad de Topografía', sigla: 'TOPOGRAFIA', parent: 'DOT', modo: 'hereda', anual: true },
  { name: 'Unidad de Equipamiento y Tierras', sigla: 'EQUIPAMIENTO', parent: 'DRU', modo: 'hereda', anual: true },
]

async function main() {
  const [{ count }] = [{ count: await repos.users.count() }]
  if (count > 0) {
    console.log('La base ya tiene usuarios. Se omite el seed (usa db:reset para reiniciar).')
    return
  }

  // ---------- Árbol de áreas ----------
  const idPorSigla = new Map<string, number>()
  const admin = await repos.users.create({
    name: 'Administrador del Sistema',
    email: `admin@${DOMINIO_CORREO}`,
    passwordHash: bcrypt.hashSync('password', 12),
    role: 'admin',
    active: true,
  })
  await repos.users.setModules(admin.id, [])
  console.log(`• Usuario admin creado (usuario: admin / admin@${DOMINIO_CORREO} / password)`)

  for (const def of ARBOL) {
    const parentId = def.parent ? idPorSigla.get(def.parent) ?? null : null
    const area = await areaService.crear({
      name: def.name,
      sigla: def.sigla,
      parentId,
      numeracionMode: def.modo,
      reiniciaAnualmente: def.anual,
    })
    idPorSigla.set(def.sigla, area.id)
    console.log(`• Área creada: ${def.name} (${def.sigla})`)
  }

  const todasLasAreas = await repos.areas.listAll()

  // ---------- 10 usuarios con faker ----------
  const roles: Array<'admin' | 'user' | 'guest'> = ['user', 'user', 'user', 'user', 'user', 'user', 'user', 'user', 'guest', 'guest']
  const usuarios: { id: number; name: string; areaId: number | null; puestoId: number | null }[] = []

  for (let i = 0; i < 10; i++) {
    const role = roles[i]
    const nombre = faker.person.fullName()
    const usuarioNombre = nombreAUsuario(nombre)
    const email = `${usuarioNombre}@${DOMINIO_CORREO}`
    const area = todasLasAreas[faker.number.int({ min: 0, max: todasLasAreas.length - 1 })]
    const puestos = await repos.areas.puestosByArea(area.id)
    const puesto = puestos[faker.number.int({ min: 0, max: Math.max(0, puestos.length - 1) })]
    const usuario = await repos.users.create({
      name: nombre,
      email,
      passwordHash: bcrypt.hashSync('password', 12),
      role,
      active: true,
    })
    const modulos: string[] = []
    if (role === 'user') {
      if (faker.datatype.boolean()) modulos.push('areas')
      if (faker.datatype.boolean()) modulos.push('documentos')
      if (modulos.length === 0) modulos.push('documentos')
    }
    await repos.users.setModules(usuario.id, modulos.filter((m): m is 'areas' | 'documentos' => m === 'areas' || m === 'documentos'))
    await repos.users.setActiveAssignment(usuario.id, area.id, puesto.id)
    usuarios.push({ id: usuario.id, name: nombre, areaId: area.id, puestoId: puesto.id })
    console.log(`• Usuario creado: ${nombre} (usuario: ${usuarioNombre} / ${email}) [${role}] en ${area.name}`)
  }

  // ---------- 50 documentos: 30 CI + 20 OF ----------
  const totalCi = 30
  const totalOf = 20
  let ci = 0
  let of = 0
  const crearDoc = async (tipo: 'ci' | 'of') => {
    const area = todasLasAreas[faker.number.int({ min: 0, max: todasLasAreas.length - 1 })]
    const usuariosDeArea = usuarios.filter((u) => u.areaId === area.id)
    const emisor = usuariosDeArea.length > 0
      ? usuariosDeArea[faker.number.int({ min: 0, max: usuariosDeArea.length - 1 })]
      : { id: admin.id, name: admin.name, areaId: null, puestoId: null }
    const referencia = faker.lorem.sentence(faker.number.int({ min: 3, max: 9 }))
    const descripcion = faker.datatype.boolean() ? faker.lorem.paragraph(2) : null
    const fecha = faker.date.between({ from: new Date(new Date().getFullYear(), 0, 1), to: new Date() })

    const conArchivos = faker.number.int({ min: 0, max: 9 }) > 6
    const archivos = conArchivos
      ? Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => {
          const ext = faker.helpers.arrayElement(['pdf', 'jpg', 'png', 'docx'])
          const name = faker.system.fileName()
          const mime = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[ext]
          return {
            name: `${name}.${ext}`,
            mime,
            size: faker.number.int({ min: 1000, max: 2_097_152 }),
            data: new TextEncoder().encode(faker.lorem.paragraph()),
          }
        })
      : []

    const destinatario = faker.datatype.boolean()
      ? { destinatarioUserId: usuarios[faker.number.int({ min: 0, max: usuarios.length - 1 })].id, destinatarioTexto: null }
      : { destinatarioUserId: null, destinatarioTexto: faker.company.name() }

    const doc = await docService.crear(
      {
        areaId: area.id,
        tipo,
        referencia: referencia.replace(/\.$/, ''),
        descripcion,
        fechaDocumento: fecha,
        archivos,
        ...destinatario,
      },
      { id: emisor.id, role: 'admin', areaId: null },
    )
    if (tipo === 'ci') ci++
    else of++
    if (ci + of <= 1 || (ci + of) % 10 === 0 || (tipo === 'ci' && ci === totalCi) || (tipo === 'of' && of === totalOf)) {
      console.log(`• Documento ${ci + of}/50: ${doc.nroCompleto} · ${ETIQUETA_TIPO[tipo]}`)
    }
  }

  while (ci < totalCi || of < totalOf) {
    const tipo: 'ci' | 'of' = ci < totalCi && (of >= totalOf || faker.number.int({ min: 0, max: 1 }) === 0) ? 'ci' : 'of'
    await crearDoc(tipo)
  }

  console.log(`Seed completado: 1 admin, ${ARBOL.length} áreas, 10 usuarios, 50 documentos (30 CI / 20 OF).`)
}

main().catch((e) => {
  console.error('Error en seed:', e)
  process.exit(1)
})