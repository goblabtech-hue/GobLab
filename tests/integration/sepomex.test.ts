import 'dotenv/config'
import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../../src/infrastructure/prisma'
import {
  leerCatalogoSepomex, estadosDe, municipiosDe, importarMunicipioSepomex, ErrorSepomex,
} from '../../src/application/sepomex'

/**
 * El archivo de muestra está en el formato exacto que entrega Correos de
 * México: Latin-1, una línea de título, encabezado con «|». Trae Tula (ya
 * cargada por el seed), otro municipio de Hidalgo con acentos, y otro estado.
 */
const bytes = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'sepomex-muestra.txt'))
const filas = leerCatalogoSepomex(bytes)

after(async () => {
  // Lo que la prueba cargó de Tepeji.
  await prisma.colonia.deleteMany({ where: { codigoPostal: { in: ['42850', '42853', '42855'] } } })
  await prisma.$disconnect()
})

describe('leer el catálogo', () => {
  test('decodifica Latin-1: los acentos salen bien', () => {
    assert.ok(filas.some((f) => f.asentamiento === 'Xochitlán de las Flores'))
    assert.ok(filas.some((f) => f.municipio === 'Tepeji del Río de Ocampo'))
    assert.ok(filas.some((f) => f.estado === 'Querétaro'))
  })

  test('ignora la línea de título y las filas sin código postal', () => {
    assert.equal(filas.length, 12)
    assert.ok(filas.every((f) => /^\d{5}$/.test(f.cp)))
  })

  test('un archivo que no es el catálogo se rechaza con un mensaje útil', () => {
    assert.throws(
      () => leerCatalogoSepomex(new TextEncoder().encode('nombre,lat,lng\nCentro,1,2\n')),
      (e: unknown) => e instanceof ErrorSepomex && /No parece el catálogo/.test(e.message),
    )
  })

  test('estados y municipios, ordenados', () => {
    assert.deepEqual(estadosDe(filas), ['Hidalgo', 'Querétaro'])
    const m = municipiosDe(filas, 'hidalgo') // minúsculas a propósito
    assert.deepEqual(m.map((x) => x.nombre), ['Tepeji del Río de Ocampo', 'Tula de Allende'])
    assert.equal(m.find((x) => x.nombre === 'Tula de Allende')?.asentamientos, 8)
  })
})

describe('importar un municipio', () => {
  test('sin acentos ni mayúsculas encuentra el municipio igual', async () => {
    const r = await importarMunicipioSepomex(filas, 'tepeji del rio de ocampo', 'HIDALGO')
    assert.equal(r.municipio, 'Tepeji del Río de Ocampo', 'devuelve el nombre como lo escribe SEPOMEX')
    assert.equal(r.creados, 3)
    assert.equal(r.actualizados, 0)
  })

  test('correrlo otra vez no duplica', async () => {
    const r = await importarMunicipioSepomex(filas, 'Tepeji del Río de Ocampo', 'Hidalgo')
    assert.equal(r.creados, 0)
    assert.equal(r.actualizados, 3)
  })

  test('el mismo nombre en dos códigos postales son dos colonias; el mismo nombre y código, una', async () => {
    // Tula ya está cargada por el seed: todo debe ser «actualizado».
    const r = await importarMunicipioSepomex(filas, 'Tula de Allende', 'Hidalgo')
    assert.equal(r.entradas, 8, 'ocho filas en el archivo')
    assert.equal(r.distintos, 7, 'El Salitre colonia + fraccionamiento (mismo CP) se quedan en una')
    assert.equal(r.creados, 0, 'Tula ya estaba')
    const bugambilias = await prisma.colonia.count({ where: { nombre: 'Bugambilias' } })
    assert.equal(bugambilias, 2, 'Bugambilias en dos códigos postales distintos son dos')
  })

  test('un municipio que no existe dice qué hacer', async () => {
    await assert.rejects(
      () => importarMunicipioSepomex(filas, 'Tula de Allende', 'Querétaro'),
      (e: unknown) => e instanceof ErrorSepomex && /Elige el municipio de la lista/.test(e.message),
    )
  })
})
