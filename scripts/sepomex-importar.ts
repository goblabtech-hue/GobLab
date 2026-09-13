import 'dotenv/config'
import fs from 'node:fs'
import { prisma } from '../src/infrastructure/prisma'
import {
  leerCatalogoSepomex, municipiosDe, estadosDe, importarMunicipioSepomex, ErrorSepomex,
} from '../src/application/sepomex'

/**
 * Versión de línea de comandos del cargador de SEPOMEX. La misma pantalla
 * existe en /admin/colonias; esto es para quien despliega sin abrir el
 * navegador.
 *
 *   npx tsx scripts/sepomex-importar.ts CPdescarga.txt "Tula de Allende" Hidalgo
 *   npx tsx scripts/sepomex-importar.ts CPdescarga.txt --municipios Hidalgo
 */

const [, , archivo, ...resto] = process.argv
const rojo = (t: string) => `\x1b[31m${t}\x1b[0m`
const verde = (t: string) => `\x1b[32m${t}\x1b[0m`
const gris = (t: string) => `\x1b[2m${t}\x1b[0m`

async function main() {
  if (!archivo) {
    console.log('Uso:')
    console.log('  npx tsx scripts/sepomex-importar.ts ARCHIVO.txt "Nombre del municipio" Estado')
    console.log('  npx tsx scripts/sepomex-importar.ts ARCHIVO.txt --municipios Estado')
    process.exit(1)
  }
  if (!fs.existsSync(archivo)) { console.error(rojo(`No encuentro el archivo: ${archivo}`)); process.exit(1) }

  const filas = leerCatalogoSepomex(fs.readFileSync(archivo))
  console.log(gris(`Catálogo: ${filas.length.toLocaleString('es-MX')} asentamientos en todo el país`))

  if (resto[0] === '--municipios') {
    const estado = resto[1]
    if (!estado) { console.error(rojo('Dime el estado: --municipios Hidalgo')); process.exit(1) }
    const lista = municipiosDe(filas, estado)
    if (lista.length === 0) {
      console.error(rojo(`No hay estado «${estado}». Los del catálogo:`))
      console.error('  ' + estadosDe(filas).join(', '))
      process.exit(1)
    }
    console.log(`\nMunicipios de ${estado} (${lista.length}):\n`)
    for (const m of lista) console.log(`  ${m.nombre.padEnd(40)} ${String(m.asentamientos).padStart(4)} asentamientos`)
    return
  }

  const [municipio, estado] = resto
  if (!municipio || !estado) { console.error(rojo('Falta el municipio o el estado: "Tula de Allende" Hidalgo')); process.exit(1) }

  const r = await importarMunicipioSepomex(filas, municipio, estado)
  console.log(`\n${r.municipio}, ${r.estado}: ${r.entradas} entradas → ${r.distintos} asentamientos distintos\n`)
  console.log(verde(`✓ ${r.creados} creados, ${r.actualizados} ya existían (se actualizó el tipo)`))
  console.log(gris('  por tipo: ' + r.porTipo.map((t) => `${t.tipo} ${t.total}`).join(' · ')))
}

main()
  .catch((e) => {
    console.error(rojo(e instanceof ErrorSepomex ? e.message : (e instanceof Error ? e.message : String(e))))
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
