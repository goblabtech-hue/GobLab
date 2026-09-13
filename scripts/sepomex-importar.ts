import 'dotenv/config'
import fs from 'node:fs'
import { prisma } from '../src/infrastructure/prisma'

/**
 * Carga los asentamientos de un municipio desde el catálogo nacional de
 * Correos de México (SEPOMEX).
 *
 *   npx tsx scripts/sepomex-importar.ts CPdescarga.txt "Tula de Allende" Hidalgo
 *   npx tsx scripts/sepomex-importar.ts CPdescarga.txt --municipios Hidalgo
 *
 * El catálogo se baja gratis de
 *   https://www.correosdemexico.gob.mx/SSLServicios/ConsultaCP/CodigoPostal_Exportar.aspx
 * eligiendo «todo el país» y formato TXT. No existe una API oficial: esto ES
 * la fuente. Los servicios que se anuncian como API son terceros revendiendo
 * este mismo archivo.
 *
 * Con esto, dar de alta un municipio nuevo es correr una línea, en vez de
 * teclear ciento cuarenta colonias o buscarlas en un espejo.
 *
 * Formato del archivo (estable desde hace años): codificado en Latin-1, la
 * primera línea es un título, la segunda los nombres de columna separados por
 * «|», y de ahí una fila por asentamiento.
 */

const [, , archivo, ...resto] = process.argv

const rojo = (t: string) => `\x1b[31m${t}\x1b[0m`
const verde = (t: string) => `\x1b[32m${t}\x1b[0m`
const gris = (t: string) => `\x1b[2m${t}\x1b[0m`

/** Sin acentos ni mayúsculas, para comparar como escribe la gente. */
const llave = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

const slugify = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

type Fila = { asentamiento: string; tipo: string; cp: string; municipio: string; estado: string }

function leerCatalogo(ruta: string): Fila[] {
  if (!fs.existsSync(ruta)) {
    console.error(rojo(`No encuentro el archivo: ${ruta}`))
    process.exit(1)
  }
  // Latin-1, no UTF-8: los acentos saldrían como «Ã©» si se leyera mal.
  const texto = new TextDecoder('latin1').decode(fs.readFileSync(ruta))
  const lineas = texto.split(/\r?\n/)

  // La primera línea con «|» es el encabezado; antes va un título libre.
  const iCab = lineas.findIndex((l) => l.includes('|') && /d_codigo|d_asenta/i.test(l))
  if (iCab < 0) {
    console.error(rojo('No parece un catálogo de SEPOMEX: no encuentro el encabezado (d_codigo|d_asenta|…).'))
    process.exit(1)
  }
  const cab = lineas[iCab]!.split('|').map((c) => c.trim().toLowerCase())
  const col = (nombre: string) => {
    const i = cab.indexOf(nombre.toLowerCase())
    if (i < 0) { console.error(rojo(`Falta la columna ${nombre} en el archivo.`)); process.exit(1) }
    return i
  }
  const iCp = col('d_codigo'), iAs = col('d_asenta'), iTipo = col('d_tipo_asenta')
  const iMun = col('D_mnpio'), iEdo = col('d_estado')

  const filas: Fila[] = []
  for (const l of lineas.slice(iCab + 1)) {
    if (!l.includes('|')) continue
    const c = l.split('|')
    const cp = (c[iCp] ?? '').trim()
    if (!/^\d{5}$/.test(cp)) continue
    filas.push({
      cp, asentamiento: (c[iAs] ?? '').trim(), tipo: (c[iTipo] ?? '').trim(),
      municipio: (c[iMun] ?? '').trim(), estado: (c[iEdo] ?? '').trim(),
    })
  }
  return filas
}

async function main() {
  if (!archivo) {
    console.log('Uso:')
    console.log('  npx tsx scripts/sepomex-importar.ts ARCHIVO.txt "Nombre del municipio" Estado')
    console.log('  npx tsx scripts/sepomex-importar.ts ARCHIVO.txt --municipios Estado')
    process.exit(1)
  }
  const filas = leerCatalogo(archivo)
  console.log(gris(`Catálogo: ${filas.length.toLocaleString('es-MX')} asentamientos en todo el país`))

  // ── Listar municipios de un estado ─────────────────────────────────────
  if (resto[0] === '--municipios') {
    const estado = resto[1]
    if (!estado) { console.error(rojo('Dime el estado: --municipios Hidalgo')); process.exit(1) }
    const del = filas.filter((f) => llave(f.estado) === llave(estado))
    if (del.length === 0) {
      const estados = [...new Set(filas.map((f) => f.estado))].sort()
      console.error(rojo(`No hay estado «${estado}». Los del catálogo:`))
      console.error('  ' + estados.join(', '))
      process.exit(1)
    }
    const conteo = new Map<string, number>()
    for (const f of del) conteo.set(f.municipio, (conteo.get(f.municipio) ?? 0) + 1)
    console.log(`\nMunicipios de ${del[0]!.estado} (${conteo.size}):\n`)
    for (const [m, n] of [...conteo].sort((a, b) => a[0].localeCompare(b[0], 'es'))) {
      console.log(`  ${m.padEnd(40)} ${String(n).padStart(4)} asentamientos`)
    }
    return
  }

  // ── Importar un municipio ──────────────────────────────────────────────
  const [municipio, estado] = resto
  if (!municipio || !estado) {
    console.error(rojo('Falta el municipio o el estado: "Tula de Allende" Hidalgo'))
    process.exit(1)
  }

  const del = filas.filter((f) => llave(f.municipio) === llave(municipio) && llave(f.estado) === llave(estado))
  if (del.length === 0) {
    console.error(rojo(`No hay «${municipio}» en ${estado}. Revisa el nombre exacto con:`))
    console.error(`  npx tsx scripts/sepomex-importar.ts ${archivo} --municipios "${estado}"`)
    process.exit(1)
  }

  // Misma regla que el seed: si dos entradas comparten nombre Y código postal
  // (se distinguen solo por el tipo), se queda una — un vecino no sabe si vive
  // en la colonia o en el fraccionamiento del mismo nombre. Si comparten
  // nombre pero no código, son lugares distintos y se conservan las dos.
  const vistos = new Set<string>()
  const unicos = del.filter((f) => {
    const k = `${llave(f.asentamiento)}|${f.cp}`
    if (vistos.has(k)) return false
    vistos.add(k); return true
  })
  const repetidos = new Set(unicos.map((f) => llave(f.asentamiento)).filter((n, i, xs) => xs.indexOf(n) !== i))

  console.log(`\n${del[0]!.municipio}, ${del[0]!.estado}: ${del.length} entradas → ${unicos.length} asentamientos distintos\n`)

  let creados = 0, actualizados = 0
  for (const f of unicos) {
    const existente = await prisma.colonia.findFirst({
      where: { nombre: { equals: f.asentamiento, mode: 'insensitive' }, codigoPostal: f.cp },
      select: { id: true },
    })
    if (existente) {
      await prisma.colonia.update({ where: { id: existente.id }, data: { tipo: f.tipo } })
      actualizados++
      continue
    }
    const base = repetidos.has(llave(f.asentamiento)) ? `${slugify(f.asentamiento)}-${f.cp}` : slugify(f.asentamiento)
    let slug = base
    for (let n = 2; await prisma.colonia.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`
    await prisma.colonia.create({ data: { nombre: f.asentamiento, slug, codigoPostal: f.cp, tipo: f.tipo } })
    creados++
  }

  const porTipo = new Map<string, number>()
  for (const f of unicos) porTipo.set(f.tipo, (porTipo.get(f.tipo) ?? 0) + 1)

  console.log(verde(`✓ ${creados} creados, ${actualizados} ya existían (se actualizó el tipo)`))
  console.log(gris('  por tipo: ' + [...porTipo].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(' · ')))
  console.log(gris('\n  Las colonias no traen coordenadas: el mapa de cada una se centra en el'))
  console.log(gris('  municipio hasta que se les ponga un centro en /admin/colonias.'))
}

main()
  .catch((e) => { console.error(rojo(e instanceof Error ? e.message : String(e))); process.exit(1) })
  .finally(() => prisma.$disconnect())
