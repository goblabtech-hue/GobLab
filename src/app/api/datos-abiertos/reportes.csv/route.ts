import { generarDataset, DICCIONARIO } from '@/application/datos-abiertos'

export const revalidate = 300

function escapar(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  const s = String(valor)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Dataset público en CSV (SPEC §4.4g). Sin datos personales. */
export async function GET() {
  const filas = await generarDataset()
  const columnas = DICCIONARIO.map((d) => d.campo)

  const lineas = [
    columnas.join(','),
    ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(',')),
  ]
  // BOM: sin él, Excel en Windows destroza los acentos
  const cuerpo = `﻿${lineas.join('\r\n')}\r\n`
  const nombre = `reportes-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(cuerpo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
