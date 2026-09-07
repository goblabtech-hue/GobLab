import 'dotenv/config'
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { leerCatalogo, columna, ErrorImportacion } from '../src/lib/importacion'

/**
 * El lector tiene que aguantar lo que de verdad manda un municipio: encabezados
 * con acentos y mayúsculas, CSV guardado por Excel en español (con BOM y punto
 * y coma), celdas con fórmula y renglones vacíos al final.
 */

async function comoXlsx(filas: string[][]): Promise<File> {
  const libro = new ExcelJS.Workbook()
  const hoja = libro.addWorksheet('Colonias')
  filas.forEach((f) => hoja.addRow(f))
  const buffer = await libro.xlsx.writeBuffer()
  return new File([buffer], 'catalogo.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

const comoCsv = (texto: string, nombre = 'catalogo.csv') =>
  new File([texto], nombre, { type: 'text/csv' })

/** Acceso a una fila esperada: si no está, la prueba falla con un mensaje claro. */
function enPosicion(filas: Record<string, string>[], i: number): Record<string, string> {
  const f = filas[i]
  if (!f) throw new Error(`Se esperaba una fila en la posición ${i}, y no hay.`)
  return f
}
const primera = (f: Record<string, string>[]) => enPosicion(f, 0)
const segunda = (f: Record<string, string>[]) => enPosicion(f, 1)

describe('lectura de Excel', () => {
  test('lee una hoja normal', async () => {
    const filas = await leerCatalogo(await comoXlsx([
      ['nombre', 'lat', 'lng'],
      ['Centro', '20.0517', '-99.3450'],
      ['El Llano', '20.0600', '-99.3400'],
    ]))
    assert.equal(filas.length, 2)
    assert.equal(columna(primera(filas), 'nombre'), 'Centro')
    assert.equal(columna(segunda(filas), 'lat'), '20.0600', 'el texto de la celda se respeta tal cual')
  })

  test('no se rompe con encabezados con acentos, mayúsculas ni espacios', async () => {
    const filas = await leerCatalogo(await comoXlsx([
      ['  Nombre de la Colonia ', 'LATITUD', 'Longitud'],
      ['San Marcos', '20.05', '-99.34'],
    ]))
    // "Nombre de la Colonia" no es "nombre": el lector busca por varios alias
    assert.equal(columna(primera(filas), 'nombredelacolonia', 'nombre'), 'San Marcos')
    assert.equal(columna(primera(filas), 'latitud', 'lat'), '20.05')
  })

  test('se salta los renglones vacíos del final', async () => {
    const filas = await leerCatalogo(await comoXlsx([
      ['nombre'], ['Centro'], ['', ''], ['El Salitre'],
    ]))
    assert.deepEqual(filas.map((f) => columna(f, 'nombre')), ['Centro', 'El Salitre'])
  })

  test('una hoja sin encabezados se rechaza con un mensaje entendible', async () => {
    const libro = new ExcelJS.Workbook()
    libro.addWorksheet('vacía')
    const buffer = await libro.xlsx.writeBuffer()
    await assert.rejects(
      () => leerCatalogo(new File([buffer], 'vacio.xlsx')),
      /primera fila/,
    )
  })
})

describe('lectura de CSV', () => {
  test('lee el CSV que guarda Excel, con BOM incluido', async () => {
    const filas = await leerCatalogo(comoCsv('﻿nombre,lat\r\nCentro,20.05\r\n'))
    assert.equal(columna(primera(filas), 'nombre'), 'Centro', 'el BOM no debe pegarse al encabezado')
  })

  test('acepta punto y coma, que es lo que produce Excel en español', async () => {
    const filas = await leerCatalogo(comoCsv('nombre;responsable;telefono\nObras;Ana Ríos;7731234567\n'))
    assert.equal(columna(primera(filas), 'responsable'), 'Ana Ríos')
    assert.equal(columna(primera(filas), 'telefono'), '7731234567')
  })

  test('respeta las comas dentro de comillas', async () => {
    const filas = await leerCatalogo(comoCsv('nombre,responsable\n"Obras, Agua y Drenaje","Ríos, Ana"\n'))
    assert.equal(columna(primera(filas), 'nombre'), 'Obras, Agua y Drenaje')
    assert.equal(columna(primera(filas), 'responsable'), 'Ríos, Ana')
  })

  test('un archivo sin datos se rechaza', async () => {
    await assert.rejects(() => leerCatalogo(comoCsv('nombre\n')), /no tiene datos/)
  })
})

describe('rechazos', () => {
  test('el .xls antiguo se rechaza diciendo cómo convertirlo', async () => {
    await assert.rejects(
      () => leerCatalogo(new File([Buffer.from('viejo')], 'colonias.xls')),
      /Guardar como/,
    )
  })

  test('un archivo vacío se rechaza', async () => {
    await assert.rejects(() => leerCatalogo(new File([], 'vacio.csv')), ErrorImportacion)
  })

  test('un PDF disfrazado de xlsx no revienta el servidor', async () => {
    await assert.rejects(
      () => leerCatalogo(new File([Buffer.from('%PDF-1.4 no soy un excel')], 'trampa.xlsx')),
      ErrorImportacion,
    )
  })
})

describe('columna()', () => {
  test('devuelve el primer alias que exista', () => {
    const fila = { dependencia: 'Obras Públicas' }
    assert.equal(columna(fila, 'nombre', 'dependencia', 'area'), 'Obras Públicas')
  })

  test('devuelve cadena vacía si no hay ninguno, en vez de undefined', () => {
    assert.equal(columna({}, 'nombre'), '')
  })
})
