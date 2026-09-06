import { NextResponse } from 'next/server'
import { procesarMensaje } from '@/lib/ia/bot'
import { WhatsAppCloudProvider, verificarWebhookWhatsApp } from '@/lib/mensajeria'

export const dynamic = 'force-dynamic'

/** Alta del webhook: Meta llama una vez con un reto que hay que devolver. */
export async function GET(request: Request) {
  const reto = verificarWebhookWhatsApp(new URL(request.url).searchParams)
  if (reto === null) {
    return new NextResponse('Verificación fallida', { status: 403 })
  }
  return new NextResponse(reto, { status: 200 })
}

/**
 * Mensajes entrantes de WhatsApp.
 *
 * Meta reintenta cualquier respuesta que no sea 2xx, así que se contesta 200
 * incluso cuando el procesamiento falla: un error nuestro no debe provocar que
 * Meta reenvíe el mismo mensaje en bucle. El fallo se registra en el servidor.
 */
export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  try {
    const entrantes = new WhatsAppCloudProvider().interpretar(payload)
    for (const mensaje of entrantes) {
      await procesarMensaje(mensaje)
    }
  } catch (e) {
    console.error('[webhook whatsapp]', e)
  }

  return NextResponse.json({ ok: true })
}
