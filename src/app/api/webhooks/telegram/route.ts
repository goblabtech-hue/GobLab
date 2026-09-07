import { NextResponse } from 'next/server'
import { procesarMensaje } from '@/application/bot'
import { TelegramProvider, webhookTelegramAutorizado } from '@/infrastructure/mensajeria'

export const dynamic = 'force-dynamic'

/**
 * Mensajes entrantes de Telegram.
 *
 * Telegram no firma sus webhooks: la única protección es el token secreto que
 * se registra con `setWebhook` y regresa en la cabecera. Sin él, cualquiera que
 * adivine la URL puede inyectar conversaciones y crear reportes falsos, así que
 * aquí sí se responde 401 en vez de 200.
 *
 * Los errores de procesamiento, en cambio, sí devuelven 200: Telegram reintenta
 * ante cualquier otra cosa y acabaría reenviando el mismo mensaje en bucle.
 */
export async function POST(request: Request) {
  if (!webhookTelegramAutorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  try {
    const entrantes = new TelegramProvider().interpretar(payload)
    for (const mensaje of entrantes) {
      await procesarMensaje(mensaje)
    }
  } catch (e) {
    console.error('[webhook telegram]', e)
  }

  return NextResponse.json({ ok: true })
}
