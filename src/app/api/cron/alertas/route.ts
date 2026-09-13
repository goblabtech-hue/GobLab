import { avisarVencidos } from '@/application/avisos-personal'
import { NextResponse } from 'next/server'
import { evaluarAlertas } from '@/application/alertas'
import { autorizadoComoCron, noAutorizado } from '@/infrastructure/cron'

export const dynamic = 'force-dynamic'

/** Evalúa las alertas internas del SPEC §4.5. Cada hora basta. */
export async function GET(request: Request) {
  if (!autorizadoComoCron(request)) return noAutorizado()

  const resultado = await evaluarAlertas()
  // Además de los umbrales globales, cada reporte que venció avisa a su área.
  const vencidosAvisados = await avisarVencidos()
  return NextResponse.json({ ok: true, ...resultado, vencidosAvisados })
}
