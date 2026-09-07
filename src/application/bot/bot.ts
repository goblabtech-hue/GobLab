import { obtenerConfiguracion } from '@/infrastructure/config'
import { prisma } from '@/infrastructure/prisma'
import { derivarTelefono, telefonoValido } from '@/domain/telefono'
import { pareceEmergencia } from './clasificador'
import {
  PALABRAS_HUMANO, PALABRAS_MENU, normalizar, type Contexto, type Estado,
} from './estado'
import { guardarEstado, obtenerConversacion, type Conversacion } from './conversacion'
import {
  manejarMenu, manejarDescripcion, manejarConfirmacionCategoria,
  manejarEleccionCategoria, menuPrincipal,
} from './flujo-alta'
import {
  manejarFoto, manejarUbicacion, manejarColonia, manejarConfirmacion, manejarAdhesion,
} from './flujo-evidencia'
import { escalar, manejarFolio } from './flujo-consulta'
import { proveedor, type MensajeEntrante, type MensajeSaliente } from '@/infrastructure/mensajeria'

/**
 * Despachador del bot: decide qué manejador atiende cada mensaje según el paso
 * en que va la conversación.
 *
 * Es agnóstico del canal —WhatsApp, Telegram y el simulador comparten este
 * mismo flujo— porque recibe `MensajeEntrante` y devuelve `MensajeSaliente`.
 */

// ---------------------------------------------------------------- entrada

export async function procesarMensaje(entrante: MensajeEntrante): Promise<MensajeSaliente[]> {
  const conversacion = await obtenerConversacion(entrante)

  // Idempotencia por id del canal: los webhooks se reintentan, y sin esto un
  // reintento crearía un segundo reporte. Deduplicar por TEXTO no sirve —
  // en un menú, dos "1" seguidos son dos respuestas legítimas distintas.
  const yaVisto = await prisma.mensajeBot.findFirst({
    where: { conversacionId: conversacion.id, idExterno: entrante.idExterno },
    select: { id: true },
  })
  if (yaVisto) return []

  await prisma.mensajeBot.create({
    data: {
      conversacionId: conversacion.id,
      direccion: 'in',
      texto: entrante.texto || (entrante.ubicacion ? '[ubicación]' : entrante.mediaUrl ? '[foto]' : ''),
      mediaUrl: entrante.mediaUrl ?? null,
      idExterno: entrante.idExterno,
    },
  })

  const respuestas = await responder(entrante, conversacion)

  for (const r of respuestas) {
    await prisma.mensajeBot.create({
      data: { conversacionId: conversacion.id, direccion: 'out', texto: r.texto },
    })
  }

  // El simulador no entrega nada: la página lee la conversación de la base.
  if (entrante.canal !== 'simulador') {
    const canal = proveedor(entrante.canal)
    for (const r of respuestas) {
      try {
        await canal.enviar(r)
      } catch (e) {
        console.error('[bot] no se pudo entregar el mensaje:', e)
      }
    }
  }

  return respuestas
}


// ---------------------------------------------------------------- flujo


export async function responder(
  entrante: MensajeEntrante,
  conversacion: Conversacion,
): Promise<MensajeSaliente[]> {
  const chatId = entrante.chatId
  const texto = entrante.texto.trim()
  const clave = normalizar(texto)
  const estado = (conversacion.estado ?? { paso: 'inicio' }) as Estado

  // El teléfono compartido por el botón nativo se guarda en cuanto llega.
  if (entrante.telefonoCompartido && telefonoValido(entrante.telefonoCompartido)) {
    await prisma.conversacionBot.update({
      where: { id: conversacion.id },
      data: derivarTelefono(entrante.telefonoCompartido),
    })
  }

  // --- salidas de emergencia, antes que cualquier estado ---
  if (PALABRAS_MENU.includes(clave)) {
    await guardarEstado(conversacion.id, { paso: 'menu' })
    return [await menuPrincipal(chatId, entrante.nombre)]
  }

  if (PALABRAS_HUMANO.some((p) => clave.includes(p)) || clave === 'op_humano') {
    return escalar(conversacion.id, chatId, 'lo pidió el ciudadano')
  }

  // SPEC §4.1: el bot NUNCA intenta resolver una emergencia.
  if (texto && pareceEmergencia(texto) && estado.paso !== 'escalado') {
    return escalar(conversacion.id, chatId, 'palabras de emergencia en el mensaje')
  }

  if (estado.paso === 'escalado') {
    return [{
      chatId,
      texto: `Ya avisamos a una persona del municipio; en cuanto pueda te contesta por aquí. Si es una emergencia, marca al ${(await obtenerConfiguracion()).telEmergencias}.`,
    }]
  }

  const ctx: Contexto = { conversacion, chatId, clave, entrante }

  switch (estado.paso) {
    case 'inicio':
      await guardarEstado(conversacion.id, { paso: 'menu' })
      return [await menuPrincipal(chatId, entrante.nombre)]

    case 'menu':
      return manejarMenu(ctx)

    case 'describiendo':
      return manejarDescripcion(ctx, texto)

    case 'confirmando_categoria':
      return manejarConfirmacionCategoria(ctx, estado)

    case 'eligiendo_categoria':
      return manejarEleccionCategoria(ctx, estado)

    case 'pidiendo_foto':
      return manejarFoto(ctx, estado)

    case 'pidiendo_ubicacion':
      return manejarUbicacion(ctx, estado)

    case 'eligiendo_colonia':
      return manejarColonia(ctx, estado)

    case 'confirmando':
      return manejarConfirmacion(ctx, estado)

    case 'ofreciendo_adhesion':
      return manejarAdhesion(ctx, estado)

    case 'pidiendo_folio':
      return manejarFolio(conversacion, chatId, texto)

    default:
      await guardarEstado(conversacion.id, { paso: 'menu' })
      return [await menuPrincipal(chatId, entrante.nombre)]
  }
}
