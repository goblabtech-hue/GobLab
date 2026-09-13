import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/infrastructure/prisma'
import { limitar } from '@/infrastructure/rate-limit'

export const dynamic = 'force-dynamic'

const esquema = z.object({
  token: z.string().min(20).max(4096),
  plataforma: z.enum(['ios', 'android']),
  /** Folio que esta persona acaba de levantar o consultar desde la app. */
  folio: z.string().regex(/^[A-Z]{2,5}-\d{4}-\d{5,}$/).optional(),
})

/**
 * La app manda aquí su token de notificaciones, y cada vez que la persona
 * levanta o consulta un folio, lo manda otra vez con ese folio: así el
 * teléfono queda ligado a los reportes que le importan y no a una identidad.
 * Nunca se pregunta quién es.
 */
export async function POST(request: Request) {
  if (!(await limitar('push-registro', 60, 60 * 60))) {
    return NextResponse.json({ error: 'Demasiados intentos' }, { status: 429 })
  }

  let datos: unknown
  try { datos = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const parsed = esquema.safeParse(datos)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const { token, plataforma, folio } = parsed.data

  if (folio) {
    const existe = await prisma.reporte.findUnique({ where: { folio }, select: { id: true } })
    if (!existe) return NextResponse.json({ error: 'Folio no encontrado' }, { status: 404 })
  }

  const actual = await prisma.dispositivoPush.findUnique({ where: { token }, select: { folios: true } })
  // Un teléfono sigue como mucho sus últimos 50 folios: suficiente para
  // cualquier vecino, y acota lo que un token filtrado podría revelar.
  const folios = folio
    ? [...new Set([...(actual?.folios ?? []), folio])].slice(-50)
    : (actual?.folios ?? [])

  await prisma.dispositivoPush.upsert({
    where: { token },
    create: { token, plataforma, folios },
    update: { plataforma, folios },
  })
  return NextResponse.json({ ok: true, folios: folios.length })
}
