import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const archivos = []
const recorrer = (dir) => {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) recorrer(ruta)
    else if (ruta.endsWith('.js')) archivos.push(ruta)
  }
}
for (const dir of ['src', 'scripts', 'test']) recorrer(dir)

let errores = 0
for (const archivo of archivos) {
  try {
    execFileSync(process.execPath, ['--check', archivo], { stdio: 'pipe' })
  } catch (e) {
    errores++
    console.error(`✗ ${archivo}\n${e.stderr}`)
  }
}
console.log(`${archivos.length} archivos revisados, ${errores} con errores de sintaxis.`)
process.exit(errores ? 1 : 0)
