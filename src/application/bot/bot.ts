import { obtenerConfiguracion } from '@/infrastructure/config'
import { prisma } from '@/infrastructure/prisma'
import { derivarTelefono, telefonoValido, cifrarTelefono, hashTelefono } from '@/domain/telefono'
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
import {
  manejarAccionesFolio, manejarSumarFoto, manejarSumarNota,
  manejarCalificacion, manejarMotivoRechazo, manejarConfirmacionResolucion,
} from './flujo-seguimiento'
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

  // --- personal municipal vinculando su chat, antes que cualquier estado ---
  const vinculo = /^\/?vincular\s+([a-z0-9]{6})$/i.exec(texto)
  if (vinculo) return vincularPersonal(entrante, vinculo[1]!.toUpperCase())

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
      return manejarFolio(ctx, texto)

    case 'folio_acciones':
      return manejarAccionesFolio(ctx, estado)

    case 'sumando_foto':
      return manejarSumarFoto(ctx, estado)

    case 'sumando_nota':
      return manejarSumarNota(ctx, estado)

    case 'confirmando_resolucion':
      return manejarConfirmacionResolucion(ctx, estado)

    case 'calificando':
      return manejarCalificacion(ctx, estado)

    case 'motivo_rechazo':
      return manejarMotivoRechazo(ctx, estado)

    default:
      await guardarEstado(conversacion.id, { paso: 'menu' })
      return [await menuPrincipal(chatId, entrante.nombre)]
  }
}


// ---------------------------------------------------------------- personal

/**
 * Un funcionario conecta este chat a su cuenta con el código que le dio el
 * administrador. A partir de aquí recibe por este chat los avisos de los
 * reportes que le tocan.
 *
 * El código se consume al usarse y vence a los 15 minutos: es la única prueba
 * de que quien escribe es quien tiene la cuenta, así que no puede quedar
 * válido por ahí.
 */
async function vincularPersonal(entrante: MensajeEntrante, codigo: string): Promise<MensajeSaliente[]> {
  const { chatId } = entrante
  if (entrante.canal !== 'telegram' && entrante.canal !== 'simulador') {
    return [{ chatId, texto: 'La vinculación es para Telegram.' }]
  }

  const u = await prisma.usuario.findUnique({
    where: { codigoVinculacion: codigo },
    select: { id: true, nombre: true, activo: true, codigoVinculacionExpira: true },
  })
  if (!u || !u.activo || !u.codigoVinculacionExpira || u.codigoVinculacionExpira < new Date()) {
    return [{ chatId, texto: 'Ese código no sirve o ya venció. Pide uno nuevo en Administración → Usuarios.' }]
  }

  await prisma.usuario.update({
    where: { id: u.id },
    data: {
      telegramChatIdCifrado: cifrarTelefono(chatId),
      telegramChatIdHash: hashTelefono(chatId),
      codigoVinculacion: null,
      codigoVinculacionExpira: null,
    },
  })

  return [{
    chatId,
    texto: `Listo, ${u.nombre}. Por aquí te voy a avisar de los reportes que te toquen: los nuevos de tu área, los que te asignen, los que el ciudadano reabra y los que se venzan.`,
  }]
}
