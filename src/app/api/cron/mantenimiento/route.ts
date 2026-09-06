import { NextResponse } from 'next/server'
import { limpiarLimites } from '@/lib/rate-limit'
import { autorizadoComoCron, noAutorizado } from '@/lib/cron'

export const dynamic = 'force-dynamic'

/** Limpieza periódica. Cada 15 minutos junto con el refresco de agregados. */
export async function GET(request: Request) {
  if (!autorizadoComoCron(request)) return noAutorizado()

  const limitesBorrados = await limpiarLimites()
  return NextResponse.json({ ok: true, limitesBorrados })
}
