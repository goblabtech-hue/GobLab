import { prisma } from '@/infrastructure/prisma'
import { derivarTelefono, hashTelefono, cifrarTelefono, telefonoValido } from '@/domain/telefono'
import type { MensajeEntrante } from '@/infrastructure/mensajeria'
import type { Estado } from './estado'

/**
 * Persistencia de la conversación.
 *
 * Solo lee y escribe: quién es el interlocutor y en qué paso va. El flujo lo
 * decide el despachador, para que este módulo no dependa de él ni al revés.
 */

export async function obtenerConversacion(entrante: MensajeEntrante) {
  const chatIdHash = hashTelefono(entrante.chatId)

  const existente = await prisma.conversacionBot.findFirst({
    where: { canal: entrante.canal, chatIdHash },
    orderBy: { updatedAt: 'desc' },
  })
  if (existente) return existente

  return prisma.conversacionBot.create({
    data: {
      canal: entrante.canal,
      chatIdHash,
      chatIdCifrado: cifrarTelefono(entrante.chatId),
      // En WhatsApp el chat id ES el teléfono, así que ya lo tenemos. El
      // simulador se comporta igual a propósito: si no, no simularía WhatsApp
      // de verdad y el flujo de calificación quedaría sin poder probarse.
      // Telegram es la excepción: ahí el chat id no es un número.
      ...(entrante.canal !== 'telegram' && telefonoValido(entrante.chatId)
        ? derivarTelefono(entrante.chatId)
        : {}),
      estado: { paso: 'inicio' } as never,
    },
  })
}

export async function guardarEstado(id: string, estado: Estado, extra: Record<string, unknown> = {}) {
  await prisma.conversacionBot.update({
    where: { id },
    data: { estado: estado as never, ...extra },
  })
}

export type Conversacion = Awaited<ReturnType<typeof obtenerConversacion>>
