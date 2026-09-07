import type { MensajeEntrante, MessagingProvider } from './provider'

/**
 * Proveedor de desarrollo (SPEC §4.1): no entrega nada a ningún lado.
 *
 * Los mensajes ya quedan guardados en `MensajeBot` por el motor del bot, y la
 * página `/dev/whatsapp` los lee de ahí. Así se prueba el flujo completo sin
 * credenciales de Meta ni de Telegram.
 */
export class SimuladorProvider implements MessagingProvider {
  readonly canal = 'simulador' as const

  async enviar(): Promise<void> {
    // Sin efecto: la conversación se lee desde la base.
  }

  interpretar(): MensajeEntrante[] {
    return []
  }
}
