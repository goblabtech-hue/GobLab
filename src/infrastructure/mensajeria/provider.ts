import type { CanalMensajeria } from '@/generated/prisma/enums'

/**
 * Mensajería tras una interfaz intercambiable (SPEC §8).
 *
 * El motor del bot no sabe si habla por WhatsApp, por Telegram o con el
 * simulador: recibe `MensajeEntrante` y devuelve `MensajeSaliente`. Eso es lo
 * que permitió agregar Telegram sin tocar una línea del flujo conversacional.
 */

export type Boton = {
  /** Lo que el motor recibirá de vuelta si el ciudadano lo toca. */
  id: string
  texto: string
}

export type MensajeSaliente = {
  chatId: string
  texto: string
  /** Respuestas rápidas. Cada canal las pinta a su manera. */
  botones?: Boton[]
  /** Pide la ubicación con el control nativo del canal. */
  pedirUbicacion?: boolean
  /** Pide el teléfono con el control nativo del canal (solo Telegram). */
  pedirTelefono?: boolean
  mediaUrl?: string
}

export type MensajeEntrante = {
  canal: CanalMensajeria
  /** Identificador del chat en su canal: teléfono en WhatsApp, chat id en Telegram. */
  chatId: string
  /** Id del mensaje en el canal, para no procesar dos veces el mismo reintento. */
  idExterno: string
  texto: string
  mediaUrl?: string
  ubicacion?: { lat: number; lng: number }
  /** El ciudadano compartió su número con el botón nativo del canal. */
  telefonoCompartido?: string
  nombre?: string
}

export interface MessagingProvider {
  readonly canal: CanalMensajeria
  /** Entrega un mensaje al ciudadano. */
  enviar(mensaje: MensajeSaliente): Promise<void>
  /** Traduce el cuerpo crudo del webhook a mensajes normalizados. */
  interpretar(payload: unknown): MensajeEntrante[]
  /**
   * Descarga una foto que mandó el ciudadano. Las fotos no llegan en el
   * webhook: el canal manda una referencia y hay que ir por los bytes con
   * las credenciales del bot.
   */
  descargarMedia?(referencia: string): Promise<{ buffer: Buffer; tipo: string }>
}

export class ErrorMensajeria extends Error {}
