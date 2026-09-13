import type { MensajeEntrante, MensajeSaliente, MessagingProvider } from './provider'

/**
 * Lo que el simulador «envió». Las pruebas lo leen para afirmar a quién y qué
 * se habría mandado por un canal de chat. Se vacía al inicio de cada prueba.
 */
export const enviadosDePrueba: MensajeSaliente[] = []

/**
 * Proveedor de desarrollo (SPEC §4.1): no entrega nada a ningún lado.
 *
 * Los mensajes ya quedan guardados en `MensajeBot` por el motor del bot, y la
 * página `/dev/whatsapp` los lee de ahí. Así se prueba el flujo completo sin
 * credenciales de Meta ni de Telegram.
 */
export class SimuladorProvider implements MessagingProvider {
  readonly canal = 'simulador' as const

  async enviar(mensaje: MensajeSaliente): Promise<void> {
    // No entrega a ningún lado: la conversación se lee desde la base. Solo se
    // anota para que las pruebas puedan afirmar qué se habría mandado.
    enviadosDePrueba.push(mensaje)
  }

  interpretar(): MensajeEntrante[] {
    return []
  }
}
