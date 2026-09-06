/**
 * Descarga de datos abiertos desde cada gráfica (SPEC §4.4e).
 *
 * Es uno de los aciertos de San Pedro que el spec pide conservar: quien ve una
 * cifra en el tablero puede bajarse la tabla que la produjo y comprobarla.
 */

function escapar(valor: unknown): string {
  const s = valor == null ? '' : String(valor)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function aCsv(filas: Record<string, unknown>[], columnas?: string[]): string {
  if (filas.length === 0) return ''
  const llaves = columnas ?? Object.keys(filas[0])
  const lineas = [
    llaves.join(','),
    ...filas.map((f) => llaves.map((k) => escapar(f[k])).join(',')),
  ]
  // BOM para que Excel en Windows abra los acentos correctamente
  return `﻿${lineas.join('\r\n')}\r\n`
}

export function descargarCsv(nombre: string, filas: Record<string, unknown>[], columnas?: string[]) {
  const blob = new Blob([aCsv(filas, columnas)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre.endsWith('.csv') ? nombre : `${nombre}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
