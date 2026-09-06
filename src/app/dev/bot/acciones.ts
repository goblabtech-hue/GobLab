'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { procesarMensaje } from '@/lib/ia/bot'
import { hashTelefono } from '@/lib/telefono'

/**
 * Acciones del simulador (SPEC §4.1).
 *
 * Solo existen en desarrollo: crean reportes reales sin verificar a nadie, así
 * que en producción tienen que estar cerradas. La comprobación se repite aquí
 * y no solo en la página porque una acción de servidor es un endpoint POST que
 * se puede llamar directo.
 */
function soloDesarrollo() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El simulador del bot no está disponible en producción.')
  }
}

export type EstadoSimulador = { error?: string }

export async function enviarAlBot(
  _previo: EstadoSimulador,
  datos: FormData,
): Promise<EstadoSimulador> {
  soloDesarrollo()

  const chatId = String(datos.get('chatId') ?? '').trim()
  const texto = String(datos.get('texto') ?? '').trim()
  const lat = datos.get('lat')
  const lng = datos.get('lng')

  if (!chatId) return { error: 'Escribe un número de teléfono para simular.' }
  if (!texto && !lat) return { error: 'Escribe algo o manda una ubicación.' }

  await procesarMensaje({
    canal: 'simulador',
    chatId,
    idExterno: `sim-${Date.now()}`,
    texto,
    ubicacion: lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined,
    nombre: String(datos.get('nombre') ?? '') || undefined,
  })

  revalidatePath('/dev/bot')
  return {}
}

export async function reiniciarConversacion(datos: FormData): Promise<void> {
  soloDesarrollo()
  const chatId = String(datos.get('chatId') ?? '').trim()
  if (!chatId) return

  await prisma.conversacionBot.deleteMany({
    where: { canal: 'simulador', chatIdHash: hashTelefono(chatId) },
  })
  revalidatePath('/dev/bot')
}
