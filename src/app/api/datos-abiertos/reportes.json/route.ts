import { NextResponse } from 'next/server'
import { generarDataset, DICCIONARIO } from '@/application/datos-abiertos'

export const revalidate = 300

/** Dataset público en JSON (SPEC §4.4g). Sin datos personales. */
export async function GET() {
  const filas = await generarDataset()
  return NextResponse.json(
    {
      generado: new Date().toISOString(),
      licencia: 'Datos abiertos de uso libre con atribución.',
      total: filas.length,
      diccionario: DICCIONARIO,
      reportes: filas,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Access-Control-Allow-Origin': '*',
      },
    },
  )
}
