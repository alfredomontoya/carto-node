import { readdirSync } from 'node:fs'
import { rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@libsql/client'

const url = process.env.DATABASE_URL ?? 'file:./data/carto.db'

async function main() {
  const filePath = url.replace(/^file:/, '')
  const abs = join(process.cwd(), filePath)
  if (existsSync(abs)) {
    rmSync(abs)
    console.log(`• Base eliminada: ${abs}`)
  }
  // limpia también el directorio de uploads del seed (puerto de migraciones)
  const uploads = join(process.cwd(), 'uploads')
  if (existsSync(uploads)) {
    for (const f of readdirSync(uploads)) rmSync(join(uploads, f))
    console.log('• Uploads limpiados.')
  }
  const client = createClient({ url })
  await client.close()
  console.log('Listo. Ejecuta ahora db:migrate y db:seed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})