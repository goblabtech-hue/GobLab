import { NextResponse } from 'next/server'
import { autocerrarResueltos } from '@/lib/reportes'
import { autorizadoComoCron, noAutorizado } from '@/lib/cron'

export const dynamic = 'force-dynamic'

/** Cierra reportes resueltos sin calificar tras 3 días (SPEC §4.3). Diario. */
export async function GET(request: Request) {
  if (!autorizadoComoCron(request)) return noAutorizado()

  const cerrados = await autocerrarResueltos()
  return NextResponse.json({ ok: true, cerrados })
}
