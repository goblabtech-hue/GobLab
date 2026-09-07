import ExcelJS from 'exceljs'

/**
 * Carga masiva de catálogos desde Excel o CSV.
 *
 * Un municipio ya tiene sus colonias y sus dependencias en una hoja de cálculo;
 * pedirle que las teclee una por una en un formulario es la forma más segura de
 * que el catálogo nunca quede completo.
 *
 * El lector es deliberadamente tolerante con los encabezados: en la práctica
 * llegan como «Colonia», «NOMBRE», «Nombre de la colonia» o con acentos de más.
 * Rechazar el archivo por el título de una columna solo hace que la persona
 * abandone.
 */

export type FilaImportada = Record<string, string>

export class ErrorImportacion extends Error {}

const LIMITE_BYTES = 5 * 1024 * 1024
const MAX_FILAS = 5000

/** «Nombre de la Colonia » -> «nombredelacolonia» */
function normalizarEncabezado(v: string): string {
  return v
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Busca una columna por cualquiera de sus nombres posibles.
 * Devuelve '' si no existe, para que quien llama decida si es obligatoria.
 */
export function columna(fila: FilaImportada, ...alias: string[]): string {
  for (const a of alias) {
    const v = fila[normalizarEncabezado(a)]
    if (v) return v.trim()
  }
  return ''
}

function desdeCsv(texto: string): FilaImportada[] {
  // Se quita el BOM que Excel escribe al guardar como CSV: sin esto, el primer
  // encabezado llega como "﻿nombre" y nunca coincide.
  const limpio = texto.replace(/^﻿/, '')
  const lineas = limpio.split(/\r?\n/).filter((l) => l.trim())
  const encabezado = lineas[0]
  if (!encabezado || lineas.length < 2) {
    throw new ErrorImportacion('El archivo no tiene datos debajo de los encabezados.')
  }

  // Excel en español guarda con punto y coma cuando la configuración regional
  // usa coma decimal.
  const separador = (encabezado.match(/;/g)?.length ?? 0) > (encabezado.match(/,/g)?.length ?? 0) ? ';' : ','

  const partir = (linea: string): string[] => {
    const celdas: string[] = []
    let actual = ''
    let entreComillas = false
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i]
      if (c === '"') {
        if (entreComillas && linea[i + 1] === '"') { actual += '"'; i++ }
        else entreComillas = !entreComillas
      } else if (c === separador && !entreComillas) {
        celdas.push(actual); actual = ''
      } else actual += c
    }
    celdas.push(actual)
    return celdas
  }

  const encabezados = partir(encabezado).map(normalizarEncabezado)
  return lineas.slice(1, MAX_FILAS + 1).map((l) => {
    const celdas = partir(l)
    const fila: FilaImportada = {}
    encabezados.forEach((h, i) => { if (h) fila[h] = (celdas[i] ?? '').trim() })
    return fila
  })
}

async function desdeExcel(buffer: Buffer): Promise<FilaImportada[]> {
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.load(buffer as unknown as ArrayBuffer)

  const hoja = libro.worksheets[0]
  if (!hoja) throw new ErrorImportacion('El archivo de Excel no tiene ninguna hoja.')

  const encabezados: string[] = []
  hoja.getRow(1).eachCell((celda, col) => {
    encabezados[col] = normalizarEncabezado(String(celda.value ?? ''))
  })
  if (encabezados.filter(Boolean).length === 0) {
    throw new ErrorImportacion('La primera fila debe traer los nombres de las columnas.')
  }

  const filas: FilaImportada[] = []
  hoja.eachRow((row, numero) => {
    if (numero === 1 || filas.length >= MAX_FILAS) return
    const fila: FilaImportada = {}
    row.eachCell((celda, col) => {
      const h = encabezados[col]
      if (!h) return
      // Una celda puede traer fórmula, texto enriquecido o un hipervínculo.
      const v = celda.value
      const texto =
        v == null ? ''
        : typeof v === 'object' && 'result' in v ? String(v.result ?? '')
        : typeof v === 'object' && 'text' in v ? String(v.text ?? '')
        : typeof v === 'object' && 'richText' in v
          ? (v.richText as { text: string }[]).map((t) => t.text).join('')
        : String(v)
      fila[h] = texto.trim()
    })
    if (Object.values(fila).some((x) => x)) filas.push(fila)
  })
  return filas
}

/** Lee un archivo subido y devuelve sus filas con los encabezados normalizados. */
export async function leerCatalogo(archivo: File): Promise<FilaImportada[]> {
  if (archivo.size === 0) throw new ErrorImportacion('El archivo está vacío.')
  if (archivo.size > LIMITE_BYTES) throw new ErrorImportacion('El archivo no puede pasar de 5 MB.')

  const nombre = archivo.name.toLowerCase()
  const buffer = Buffer.from(await archivo.arrayBuffer())

  try {
    if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) {
      return desdeCsv(buffer.toString('utf8'))
    }
    if (nombre.endsWith('.xlsx') || nombre.endsWith('.xlsm')) {
      // El `await` no es decorativo: sin él se devuelve la promesa y su rechazo
      // escapa de este try/catch, así que un archivo corrupto le mostraría al
      // usuario el error crudo de la librería de ZIP en inglés.
      return await desdeExcel(buffer)
    }
  } catch (e) {
    if (e instanceof ErrorImportacion) throw e
    throw new ErrorImportacion(
      'No pudimos leer el archivo. Revisa que sea un Excel (.xlsx) o un CSV válido.',
    )
  }

  throw new ErrorImportacion(
    'Formato no soportado. Sube un .xlsx o un .csv. ' +
    'El .xls antiguo no sirve: ábrelo en Excel y usa «Guardar como → Libro de Excel».',
  )
}

export type ResultadoImportacion = {
  creados: number
  actualizados: number
  omitidos: number
  errores: string[]
}
