import { NextResponse } from 'next/server'
import { evaluarAlertas } from '@/lib/alertas'
import { autorizadoComoCron, noAutorizado } from '@/lib/cron'

export const dynamic = 'force-dynamic'

/** Evalúa las alertas internas del SPEC §4.5. Cada hora basta. */
export async function GET(request: Request) {
  if (!autorizadoComoCron(request)) return noAutorizado()

  const resultado = await evaluarAlertas()
  return NextResponse.json({ ok: true, ...resultado })
}
