import { SimuladorProvider } from './simulador'
import { WhatsAppCloudProvider } from './whatsapp-cloud'
import { TelegramProvider } from './telegram'
import type { CanalMensajeria } from '@/generated/prisma/enums'
import type { MessagingProvider } from './provider'

export * from './provider'
export { SimuladorProvider } from './simulador'
export { WhatsAppCloudProvider, verificarWebhookWhatsApp } from './whatsapp-cloud'
export { TelegramProvider, webhookTelegramAutorizado } from './telegram'

const instancias = new Map<CanalMensajeria, MessagingProvider>()

/**
 * Proveedor de un canal concreto.
 *
 * En desarrollo, WhatsApp cae al simulador salvo que se hayan configurado las
 * credenciales de Meta: así el flujo completo se puede probar sin tramitar
 * nada con Facebook (SPEC §4.1).
 */
export function proveedor(canal: CanalMensajeria): MessagingProvider {
  const guardado = instancias.get(canal)
  if (guardado) return guardado

  let nuevo: MessagingProvider
  switch (canal) {
    case 'telegram':
      nuevo = new TelegramProvider()
      break
    case 'whatsapp':
      nuevo = process.env.MESSAGING_DRIVER === 'whatsapp_cloud' && process.env.WHATSAPP_TOKEN
        ? new WhatsAppCloudProvider()
        : new SimuladorProvider()
      break
    default:
      nuevo = new SimuladorProvider()
  }

  instancias.set(canal, nuevo)
  return nuevo
}

/** Qué canales están realmente configurados, para la pantalla de dev. */
export function canalesActivos(): { canal: CanalMensajeria; listo: boolean; falta?: string }[] {
  return [
    {
      canal: 'whatsapp',
      listo: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
      falta: 'WHATSAPP_TOKEN y WHATSAPP_PHONE_ID',
    },
    {
      canal: 'telegram',
      listo: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET),
      falta: 'TELEGRAM_BOT_TOKEN y TELEGRAM_WEBHOOK_SECRET',
    },
    { canal: 'simulador', listo: true },
  ]
}
