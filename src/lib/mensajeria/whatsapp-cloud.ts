import {
  ErrorMensajeria, type MensajeEntrante, type MensajeSaliente, type MessagingProvider,
} from './provider'

/**
 * WhatsApp Cloud API de Meta (SPEC §8).
 *
 * Los botones de WhatsApp tienen límites duros que Meta rechaza con un 400
 * poco descriptivo: máximo 3 respuestas rápidas, 20 caracteres de texto y 24
 * de id. Se recortan aquí en vez de dejar que reviente en producción.
 */

const MAX_BOTONES = 3
const MAX_TEXTO_BOTON = 20
const MAX_ID_BOTON = 24

type EntradaWhatsApp = {
  entry?: {
    changes?: {
      value?: {
        messages?: {
          id: string
          from: string
          type: string
          text?: { body: string }
          image?: { id: string }
          location?: { latitude: number; longitude: number }
          interactive?: { button_reply?: { id: string }; list_reply?: { id: string } }
        }[]
        contacts?: { profile?: { name?: string } }[]
      }
    }[]
  }[]
}

export class WhatsAppCloudProvider implements MessagingProvider {
  readonly canal = 'whatsapp' as const

  private get credenciales() {
    const token = process.env.WHATSAPP_TOKEN
    const phoneId = process.env.WHATSAPP_PHONE_ID
    if (!token || !phoneId) {
      throw new ErrorMensajeria(
        'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID. Usa MESSAGING_DRIVER=simulador mientras tanto.',
      )
    }
    return { token, phoneId }
  }

  async enviar(mensaje: MensajeSaliente): Promise<void> {
    const { token, phoneId } = this.credenciales
    const botones = mensaje.botones?.slice(0, MAX_BOTONES) ?? []

    const cuerpo = botones.length
      ? {
          messaging_product: 'whatsapp',
          to: mensaje.chatId,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: mensaje.texto },
            action: {
              buttons: botones.map((b) => ({
                type: 'reply',
                reply: {
                  id: b.id.slice(0, MAX_ID_BOTON),
                  title: b.texto.slice(0, MAX_TEXTO_BOTON),
                },
              })),
            },
          },
        }
      : { messaging_product: 'whatsapp', to: mensaje.chatId, type: 'text', text: { body: mensaje.texto } }

    const respuesta = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })

    if (!respuesta.ok) {
      throw new ErrorMensajeria(
        `WhatsApp rechazó el envío (${respuesta.status}): ${await respuesta.text()}`,
      )
    }
  }

  /**
   * Las fotos de WhatsApp se bajan en dos pasos: primero se pide la URL
   * temporal del medio y después se descarga, ambas con el mismo token.
   */
  async descargarMedia(referencia: string): Promise<{ buffer: Buffer; tipo: string }> {
    const { token } = this.credenciales
    const mediaId = referencia.replace(/^whatsapp-media:/, '')

    const meta = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!meta.ok) throw new ErrorMensajeria('No se pudo consultar el medio en WhatsApp.')
    const { url } = (await meta.json()) as { url?: string }
    if (!url) throw new ErrorMensajeria('WhatsApp no devolvió la URL del medio.')

    const archivo = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!archivo.ok) throw new ErrorMensajeria('No se pudo descargar la foto de WhatsApp.')

    return {
      buffer: Buffer.from(await archivo.arrayBuffer()),
      tipo: archivo.headers.get('content-type') ?? 'image/jpeg',
    }
  }

  interpretar(payload: unknown): MensajeEntrante[] {
    const datos = payload as EntradaWhatsApp
    const salida: MensajeEntrante[] = []

    for (const entrada of datos.entry ?? []) {
      for (const cambio of entrada.changes ?? []) {
        const nombre = cambio.value?.contacts?.[0]?.profile?.name
        for (const m of cambio.value?.messages ?? []) {
          // Un botón llega como `interactive`; su id es lo que el motor espera.
          const idBoton = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id
          salida.push({
            canal: 'whatsapp',
            chatId: m.from,
            idExterno: m.id,
            texto: idBoton ?? m.text?.body ?? '',
            mediaUrl: m.image ? `whatsapp-media:${m.image.id}` : undefined,
            ubicacion: m.location
              ? { lat: m.location.latitude, lng: m.location.longitude }
              : undefined,
            nombre,
          })
        }
      }
    }
    return salida
  }
}

/** Verificación del webhook que hace Meta al darlo de alta. */
export function verificarWebhookWhatsApp(params: URLSearchParams): string | null {
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN
  if (!esperado) return null
  if (params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === esperado) {
    return params.get('hub.challenge')
  }
  return null
}
