import { prisma } from '@/infrastructure/prisma'

/**
 * Catálogo nacional de códigos postales de Correos de México (SEPOMEX).
 *
 * No existe una API oficial de colonias: lo oficial es este archivo,
 * gratuito, con todos los asentamientos del país. Los servicios que se
 * anuncian como «API de códigos postales» son terceros revendiendo el mismo
 * archivo. Con esto, dar de alta cualquier municipio del país es elegirlo de
 * una lista.
 *
 * Formato (estable desde hace años): Latin-1, la primera línea es un título
 * libre, la segunda los nombres de columna separados por «|», y de ahí una
 * fila por asentamiento.
 */

export type FilaSepomex = {
  asentamiento: string
  tipo: string
  cp: string
  municipio: string
  estado: string
}

export class ErrorSepomex extends Error {}

/** Sin acentos ni mayúsculas: nadie sabe de memoria cómo lo escribe SEPOMEX. */
export const llave = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

const slugify = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function leerCatalogoSepomex(bytes: Uint8Array): FilaSepomex[] {
  // Latin-1, no UTF-8: los acentos saldrían como «Ã©» si se leyera mal.
  const texto = new TextDecoder('latin1').decode(bytes)
  const lineas = texto.split(/\r?\n/)

  const iCab = lineas.findIndex((l) => l.includes('|') && /d_codigo|d_asenta/i.test(l))
  if (iCab < 0) {
    throw new ErrorSepomex(
      'No parece el catálogo de SEPOMEX: no encuentro el encabezado (d_codigo|d_asenta|…). ' +
      'Bájalo de correosdemexico.gob.mx en formato TXT, opción «todo el país».',
    )
  }
  const cab = lineas[iCab]!.split('|').map((c) => c.trim().toLowerCase())
  const col = (nombre: string) => {
    const i = cab.indexOf(nombre.toLowerCase())
    if (i < 0) throw new ErrorSepomex(`Al archivo le falta la columna ${nombre}.`)
    return i
  }
  const iCp = col('d_codigo'), iAs = col('d_asenta'), iTipo = col('d_tipo_asenta')
  const iMun = col('D_mnpio'), iEdo = col('d_estado')

  const filas: FilaSepomex[] = []
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
  if (filas.length === 0) throw new ErrorSepomex('El archivo no trae asentamientos.')
  return filas
}

export function estadosDe(filas: FilaSepomex[]): string[] {
  return [...new Set(filas.map((f) => f.estado))].sort((a, b) => a.localeCompare(b, 'es'))
}

export function municipiosDe(filas: FilaSepomex[], estado: string): { nombre: string; asentamientos: number }[] {
  const conteo = new Map<string, number>()
  for (const f of filas) {
    if (llave(f.estado) !== llave(estado)) continue
    conteo.set(f.municipio, (conteo.get(f.municipio) ?? 0) + 1)
  }
  return [...conteo]
    .map(([nombre, asentamientos]) => ({ nombre, asentamientos }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export type ResumenSepomex = {
  municipio: string
  estado: string
  entradas: number
  distintos: number
  creados: number
  actualizados: number
  porTipo: { tipo: string; total: number }[]
}

/**
 * Carga los asentamientos de un municipio a la tabla Colonia.
 *
 * Misma regla que el seed: dos entradas con el mismo nombre y código postal
 * (se distinguen solo por el tipo) se quedan en una — un vecino no sabe si
 * vive en la colonia o en el fraccionamiento del mismo nombre. Si comparten
 * nombre pero no código, son lugares distintos y se conservan las dos, y el
 * código va en el slug para distinguirlas.
 */
export async function importarMunicipioSepomex(
  filas: FilaSepomex[], municipio: string, estado: string,
): Promise<ResumenSepomex> {
  const del = filas.filter((f) => llave(f.municipio) === llave(municipio) && llave(f.estado) === llave(estado))
  if (del.length === 0) {
    throw new ErrorSepomex(`No hay «${municipio}» en ${estado}. Elige el municipio de la lista.`)
  }

  const vistos = new Set<string>()
  const unicos = del.filter((f) => {
    const k = `${llave(f.asentamiento)}|${f.cp}`
    if (vistos.has(k)) return false
    vistos.add(k); return true
  })
  const repetidos = new Set(unicos.map((f) => llave(f.asentamiento)).filter((n, i, xs) => xs.indexOf(n) !== i))

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

  return {
    municipio: del[0]!.municipio, estado: del[0]!.estado,
    entradas: del.length, distintos: unicos.length, creados, actualizados,
    porTipo: [...porTipo].map(([tipo, total]) => ({ tipo, total })).sort((a, b) => b.total - a.total),
  }
}
