import {
  ErrorMensajeria, type MensajeEntrante, type MensajeSaliente, type MessagingProvider,
} from './provider'

/**
 * Bot de Telegram.
 *
 * No está en el SPEC: se agregó a petición del municipio. Encajó sin tocar el
 * motor conversacional justo porque el §8 exigía que la mensajería viviera
 * tras una interfaz intercambiable.
 *
 * Dos diferencias de fondo con WhatsApp:
 *
 *  · Telegram identifica al usuario por `chat.id`, no por teléfono. Para poder
 *    avisarle por otros medios se le pide compartir el número con el botón
 *    nativo `request_contact`, que es explícito y revocable. Si no lo comparte,
 *    igual puede reportar: las notificaciones le llegan por el propio Telegram.
 *  · No tiene el límite de 3 botones de WhatsApp, así que el menú se pinta
 *    completo en un teclado de respuesta.
 */

type ActualizacionTelegram = {
  update_id?: number
  message?: {
    message_id: number
    chat: { id: number }
    from?: { first_name?: string }
    text?: string
    photo?: { file_id: string; file_size?: number }[]
    location?: { latitude: number; longitude: number }
    contact?: { phone_number: string }
  }
  callback_query?: {
    id: string
    data?: string
    message?: { message_id: number; chat: { id: number } }
    from?: { first_name?: string }
  }
}

/**
 * Traduce el formato del motor al de Telegram.
 *
 * El motor escribe `*así*`, que es como se marcan las negritas en WhatsApp.
 * Telegram no interpreta nada salvo que se le pida un `parse_mode`, así que
 * sin esto el ciudadano ve los asteriscos tal cual: «Tu folio es
 * *TUL-2026-00346*».
 *
 * Se usa HTML y no Markdown a propósito. El texto que se manda incluye lo que
 * el ciudadano escribió —su descripción aparece en la confirmación— y el
 * Markdown de Telegram es estricto: un guion bajo suelto o un asterisco sin
 * pareja hacen que Telegram rechace el mensaje entero con un 400. Con HTML se
 * escapa primero todo lo peligroso y después se aplican las negritas, así que
 * nada de lo que escriba una persona puede romper el envío.
 */
export function aHtmlTelegram(texto: string): string {
  const escapado = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Después de escapar: así un `<b>` que haya escrito el ciudadano ya es texto
  // inerte y no puede colarse como etiqueta.
  return escapado.replace(/\*{1,2}([^*\n]+)\*{1,2}/g, '<b>$1</b>')
}

export class TelegramProvider implements MessagingProvider {
  readonly canal = 'telegram' as const

  private get token(): string {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      throw new ErrorMensajeria(
        'Falta TELEGRAM_BOT_TOKEN. Pídelo a @BotFather en Telegram.',
      )
    }
    return token
  }

  private async llamar(metodo: string, cuerpo: Record<string, unknown>) {
    const respuesta = await fetch(`https://api.telegram.org/bot${this.token}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    if (!respuesta.ok) {
      throw new ErrorMensajeria(
        `Telegram rechazó ${metodo} (${respuesta.status}): ${await respuesta.text()}`,
      )
    }
    return respuesta.json()
  }

  /**
   * Vuelve absoluta la ruta de una foto.
   *
   * Telegram descarga la imagen desde sus servidores, así que `/uploads/...`
   * no le dice nada: necesita una URL que exista en internet. Con
   * almacenamiento S3 la URL ya viene completa; con disco local hay que
   * anteponer el dominio público del sitio.
   */
  private absoluta(url: string): string | null {
    if (/^https?:\/\//.test(url)) return url
    const base = process.env.SITIO_URL?.trim().replace(/\/$/, '')
    if (!base) return null
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`
  }

  async enviar(mensaje: MensajeSaliente): Promise<void> {
    // Con foto se manda `sendPhoto`: la evidencia del trabajo terminado tiene
    // que verse en el chat, no ser un enlace que casi nadie abre.
    if (mensaje.mediaUrl) {
      const foto = this.absoluta(mensaje.mediaUrl)
      if (foto) {
        const texto = aHtmlTelegram(mensaje.texto)
        // El pie de foto de Telegram admite 1024 caracteres; el mensaje
        // suelto, 4096. Si no cabe, va la foto y luego el texto completo,
        // en vez de recortar lo que se le prometió a la persona.
        const cabe = texto.length <= 1000
        try {
          await this.llamar('sendPhoto', {
            chat_id: mensaje.chatId,
            photo: foto,
            ...(cabe ? { caption: texto, parse_mode: 'HTML' } : {}),
          })
          if (cabe && !mensaje.botones?.length) return
        } catch (e) {
          // Que no se pueda mandar la foto no puede impedir el aviso: la
          // persona tiene que enterarse igual de que su reporte se resolvió.
          console.error('[telegram] no se pudo enviar la foto:', e)
        }
      }
    }

    const cuerpo: Record<string, unknown> = {
      chat_id: mensaje.chatId,
      text: aHtmlTelegram(mensaje.texto),
      parse_mode: 'HTML',
    }

    if (mensaje.pedirTelefono || mensaje.pedirUbicacion) {
      // Teclado nativo: el permiso lo da el ciudadano con un toque explícito.
      cuerpo.reply_markup = {
        keyboard: [
          ...(mensaje.pedirTelefono
            ? [[{ text: '📱 Compartir mi teléfono', request_contact: true }]]
            : []),
          ...(mensaje.pedirUbicacion
            ? [[{ text: '📍 Enviar mi ubicación', request_location: true }]]
            : []),
          ...(mensaje.botones ?? []).map((b) => [{ text: b.texto }]),
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      }
    } else if (mensaje.botones?.length) {
      // Botones en línea: el `callback_data` regresa tal cual al motor.
      cuerpo.reply_markup = {
        inline_keyboard: mensaje.botones.map((b) => [
          { text: b.texto, callback_data: b.id.slice(0, 64) },
        ]),
      }
    } else {
      cuerpo.reply_markup = { remove_keyboard: true }
    }

    await this.llamar('sendMessage', cuerpo)
  }

  interpretar(payload: unknown): MensajeEntrante[] {
    const u = payload as ActualizacionTelegram

    // Un toque en un botón en línea: hay que confirmarlo o Telegram deja el
    // botón "cargando" en la pantalla del ciudadano.
    if (u.callback_query?.message) {
      const q = u.callback_query
      void this.llamar('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {})
      return [{
        canal: 'telegram',
        chatId: String(q.message!.chat.id),
        idExterno: `cb:${q.id}`,
        texto: q.data ?? '',
        nombre: q.from?.first_name,
      }]
    }

    const m = u.message
    if (!m) return []

    // La foto llega en varios tamaños; el último es el de mayor resolución.
    const foto = m.photo?.[m.photo.length - 1]

    return [{
      canal: 'telegram',
      chatId: String(m.chat.id),
      idExterno: String(m.message_id),
      texto: m.text ?? '',
      mediaUrl: foto ? `telegram-file:${foto.file_id}` : undefined,
      ubicacion: m.location
        ? { lat: m.location.latitude, lng: m.location.longitude }
        : undefined,
      telefonoCompartido: m.contact?.phone_number,
      nombre: m.from?.first_name,
    }]
  }

  /** Descarga una foto que mandó el ciudadano y devuelve sus bytes. */
  async descargarMedia(referencia: string): Promise<{ buffer: Buffer; tipo: string }> {
    const fileId = referencia.replace(/^telegram-file:/, '')
    const info = await this.llamar('getFile', { file_id: fileId }) as {
      result?: { file_path?: string }
    }
    const ruta = info.result?.file_path
    if (!ruta) throw new ErrorMensajeria('Telegram no devolvió la ruta del archivo.')

    const respuesta = await fetch(`https://api.telegram.org/file/bot${this.token}/${ruta}`)
    if (!respuesta.ok) throw new ErrorMensajeria('No se pudo descargar el archivo de Telegram.')

    return {
      buffer: Buffer.from(await respuesta.arrayBuffer()),
      tipo: respuesta.headers.get('content-type') ?? 'image/jpeg',
    }
  }
}

/**
 * Telegram no firma sus webhooks: la protección es un token secreto que se
 * registra con `setWebhook` y vuelve en esta cabecera. Sin esto, cualquiera que
 * adivine la URL puede inyectar conversaciones.
 */
export function webhookTelegramAutorizado(request: Request): boolean {
  const esperado = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!esperado) return false
  return request.headers.get('x-telegram-bot-api-secret-token') === esperado
}
