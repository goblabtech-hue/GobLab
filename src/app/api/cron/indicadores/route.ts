import { NextResponse } from 'next/server'
import { refrescarIndicadores } from '@/application/indicadores'
import { autorizadoComoCron, noAutorizado } from '@/infrastructure/cron'

export const dynamic = 'force-dynamic'

/** Refresca los agregados del tablero (SPEC §7). Cada 15 minutos. */
export async function GET(request: Request) {
  if (!autorizadoComoCron(request)) return noAutorizado()

  const inicio = Date.now()
  const datos = await refrescarIndicadores()
  return NextResponse.json({
    ok: true,
    ms: Date.now() - inicio,
    recibidos: datos.resumen.recibidos.valor,
  })
}
