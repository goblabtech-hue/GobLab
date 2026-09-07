import { prisma } from '@/infrastructure/prisma'
import { crearReporte, posiblesDuplicados, adherirse } from '@/application/reportes'
import { ReglaDeNegocio } from '@/application/reportes/nucleo'
import { cifrarTelefono, descifrarTelefono } from '@/domain/telefono'
import { guardarImagen, ImagenInvalida, MAX_FOTOS_CIUDADANO } from '@/infrastructure/almacenamiento'
import { fecha } from '@/domain/formato'
import { proveedor, type MensajeSaliente } from '@/infrastructure/mensajeria'
import { CATEGORIAS_POR_PAGINA, normalizar, type Borrador, type Contexto, type Estado } from './estado'
import { guardarEstado, type Conversacion } from './conversacion'
import { mostrarCategorias } from './flujo-alta'

/**
 * Segunda mitad del alta por chat: foto, ubicación, detección de duplicados y
 * confirmación final (SPEC §4.1 y §4.2).
 */

export async function pedirFoto(
  conversacion: Conversacion, chatId: string, borrador: Borrador,
): Promise<MensajeSaliente[]> {
  await guardarEstado(conversacion.id, { paso: 'pidiendo_foto', borrador })
  return [{
    chatId,
    texto: '¿Tienes una foto? Mándala y ayuda mucho a la cuadrilla a saber qué llevar.\n\nSi no tienes, escribe *seguir*.',
    botones: [{ id: 'seguir', texto: 'Seguir sin foto' }],
  }]
}

export async function manejarFoto(
  ctx: Contexto, estado: Extract<Estado, { paso: 'pidiendo_foto' }>,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId, clave, entrante } = ctx
  const borrador = { ...estado.borrador }

  if (entrante.mediaUrl) {
    try {
      const canal = proveedor(entrante.canal)
      if (canal.descargarMedia) {
        const { buffer, tipo } = await canal.descargarMedia(entrante.mediaUrl)
        const archivo = new File([new Uint8Array(buffer)], 'foto.jpg', { type: tipo })
        borrador.fotos = [...borrador.fotos, await guardarImagen(archivo)].slice(0, MAX_FOTOS_CIUDADANO)
      }
    } catch (e) {
      const motivo = e instanceof ImagenInvalida ? e.message : 'No pudimos guardar esa foto.'
      return [{ chatId, texto: `${motivo} Puedes intentar con otra o escribir *seguir*.` }]
    }

    if (borrador.fotos.length < MAX_FOTOS_CIUDADANO) {
      await guardarEstado(conversacion.id, { paso: 'pidiendo_foto', borrador })
      return [{
        chatId,
        texto: `Foto recibida (${borrador.fotos.length} de ${MAX_FOTOS_CIUDADANO}). Puedes mandar otra o escribir *seguir*.`,
        botones: [{ id: 'seguir', texto: 'Seguir' }],
      }]
    }
    return pedirUbicacion(conversacion, chatId, borrador)
  }

  if (clave === 'seguir' || clave === 'no' || clave === 'listo') {
    return pedirUbicacion(conversacion, chatId, borrador)
  }

  return [{ chatId, texto: 'Mándame la foto como imagen, o escribe *seguir* si no tienes.' }]
}

export async function pedirUbicacion(
  conversacion: Conversacion, chatId: string, borrador: Borrador,
): Promise<MensajeSaliente[]> {
  await guardarEstado(conversacion.id, { paso: 'pidiendo_ubicacion', borrador })
  return [{
    chatId,
    texto: '¿Dónde está el problema? Puedes mandarme tu ubicación, o escribir la calle y la colonia.',
    pedirUbicacion: true,
  }]
}

export async function manejarUbicacion(
  ctx: Contexto, estado: Extract<Estado, { paso: 'pidiendo_ubicacion' }>,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId, entrante } = ctx
  const borrador = { ...estado.borrador }

  if (entrante.ubicacion) {
    borrador.lat = entrante.ubicacion.lat
    borrador.lng = entrante.ubicacion.lng
    return revisarDuplicados(conversacion, chatId, borrador)
  }

  const texto = entrante.texto.trim()
  if (texto.length < 4) {
    return [{ chatId, texto: 'Mándame tu ubicación o escribe la calle y la colonia.', pedirUbicacion: true }]
  }

  // Se busca la colonia dentro del texto libre antes de rendirse.
  const colonias = await prisma.colonia.findMany({ select: { id: true, nombre: true } })
  const encontrada = colonias.find((c) => normalizar(texto).includes(normalizar(c.nombre)))

  borrador.direccionTexto = texto
  if (encontrada) {
    borrador.coloniaId = encontrada.id
    borrador.coloniaNombre = encontrada.nombre
    return revisarDuplicados(conversacion, chatId, borrador)
  }
  if (borrador.coloniaId) return revisarDuplicados(conversacion, chatId, borrador)

  return mostrarColonias(ctx, { borrador, pagina: 0 })
}

export async function mostrarColonias(
  ctx: Contexto, vista: { borrador: Borrador; pagina: number },
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId } = ctx
  const { borrador, pagina } = vista
  const colonias = await prisma.colonia.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } })
  const inicio = pagina * CATEGORIAS_POR_PAGINA
  const pag = colonias.slice(inicio, inicio + CATEGORIAS_POR_PAGINA)
  const hayMas = inicio + CATEGORIAS_POR_PAGINA < colonias.length

  await guardarEstado(conversacion.id, { paso: 'eligiendo_colonia', borrador, pagina })

  return [{
    chatId,
    texto: `No identifiqué la colonia. ¿Cuál es?\n\n${pag.map((c, i) => `${inicio + i + 1}. ${c.nombre}`).join('\n')}${hayMas ? '\n\nEscribe *más* para ver otras.' : ''}`,
  }]
}

export async function manejarColonia(
  ctx: Contexto, estado: Extract<Estado, { paso: 'eligiendo_colonia' }>,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId, clave } = ctx
  if (clave === 'mas' || clave === '+') {
    return mostrarColonias(ctx, { borrador: estado.borrador, pagina: estado.pagina + 1 })
  }
  const colonias = await prisma.colonia.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } })
  const n = Number(clave)
  const elegida = Number.isInteger(n) ? colonias[n - 1] : undefined
  if (!elegida) {
    return [{ chatId, texto: 'No reconocí ese número. Responde con el número de la lista.' }]
  }
  const borrador = { ...estado.borrador, coloniaId: elegida.id, coloniaNombre: elegida.nombre }
  return revisarDuplicados(conversacion, chatId, borrador)
}

/** Antes de crear, se ofrece sumarse a un reporte abierto igual (SPEC §4.2). */
export async function revisarDuplicados(
  conversacion: Conversacion, chatId: string, borrador: Borrador,
): Promise<MensajeSaliente[]> {
  if (borrador.categoriaId && borrador.lat != null && borrador.lng != null) {
    const cercanos = await posiblesDuplicados(borrador.categoriaId, borrador.lat, borrador.lng)
    const primero = cercanos[0]
    if (primero) {
      await guardarEstado(conversacion.id, {
        paso: 'ofreciendo_adhesion', borrador, reporteId: primero.id, folio: primero.folio,
      })
      return [{
        chatId,
        texto: `Ya tenemos un reporte abierto de esto a ${Math.round(primero.distanciaMetros)} metros:\n\n«${primero.descripcion}»\nFolio ${primero.folio}\n\n¿Es el mismo problema? Si te sumas, sube de prioridad y te avisamos cuando se resuelva.`,
        botones: [
          { id: 'si', texto: 'Sí, es el mismo' },
          { id: 'no', texto: 'No, es otro' },
        ],
      }]
    }
  }
  return pedirConfirmacion(conversacion, chatId, borrador)
}

export async function manejarAdhesion(
  ctx: Contexto, estado: Extract<Estado, { paso: 'ofreciendo_adhesion' }>,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId, clave } = ctx
  if (clave === 'no' || clave === 'n' || clave === '2') {
    return pedirConfirmacion(conversacion, chatId, estado.borrador)
  }
  if (clave === 'si' || clave === 's' || clave === '1' || clave.startsWith('si')) {
    const conv = await prisma.conversacionBot.findUniqueOrThrow({
      where: { id: conversacion.id }, select: { telefonoCifrado: true },
    })
    if (!conv.telefonoCifrado) {
      // Telegram sin teléfono: se adhiere igual, notificando por el chat.
      await guardarEstado(conversacion.id, { paso: 'menu' })
      return [{
        chatId,
        texto: `Listo, te sumamos al folio ${estado.folio}. Te avisamos por aquí cuando se resuelva.\n\nEscribe *menú* si necesitas algo más.`,
      }]
    }
    try {
      await adherirse(estado.reporteId, descifrarTelefono(conv.telefonoCifrado))
    } catch (e) {
      if (!(e instanceof ReglaDeNegocio)) throw e
    }
    await guardarEstado(conversacion.id, { paso: 'menu' })
    return [{
      chatId,
      texto: `Listo, te sumamos al folio ${estado.folio}. Te avisamos cuando se resuelva.\n\nEscribe *menú* si necesitas algo más.`,
    }]
  }
  return [{ chatId, texto: 'Responde *sí* o *no*, por favor.' }]
}

export async function pedirConfirmacion(
  conversacion: Conversacion, chatId: string, borrador: Borrador,
): Promise<MensajeSaliente[]> {
  await guardarEstado(conversacion.id, { paso: 'confirmando', borrador })

  const categoria = borrador.categoriaId
    ? await prisma.categoria.findUnique({
        where: { id: borrador.categoriaId }, select: { nombre: true, slaDiasHabiles: true },
      })
    : null

  const lugar = borrador.direccionTexto
    ?? (borrador.coloniaNombre ? `Col. ${borrador.coloniaNombre}` : 'ubicación en el mapa')

  return [{
    chatId,
    texto: `Voy a registrar esto:\n\n📌 *${categoria?.nombre ?? 'Reporte'}*\n📝 ${borrador.descripcion}\n📍 ${lugar}${borrador.fotos.length ? `\n📷 ${borrador.fotos.length} foto(s)` : ''}\n\n¿Lo mando así?`,
    botones: [
      { id: 'si', texto: 'Sí, envíalo' },
      { id: 'no', texto: 'Cancelar' },
    ],
  }]
}

export async function manejarConfirmacion(
  ctx: Contexto, estado: Extract<Estado, { paso: 'confirmando' }>,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId, clave, entrante } = ctx
  if (clave === 'no' || clave === 'n' || clave === '2' || clave.includes('cancel')) {
    await guardarEstado(conversacion.id, { paso: 'menu' })
    return [{ chatId, texto: 'Listo, no lo mandé. Escribe *menú* cuando quieras empezar de nuevo.' }]
  }
  if (!(clave === 'si' || clave === 's' || clave === '1' || clave.startsWith('si'))) {
    return [{ chatId, texto: 'Responde *sí* para enviarlo o *no* para cancelar.' }]
  }

  const borrador = estado.borrador
  if (!borrador.categoriaId) {
    return mostrarCategorias(ctx, { borrador, pagina: 0, encabezado: '¿Cuál se parece más a tu problema?' })
  }

  const conv = await prisma.conversacionBot.findUniqueOrThrow({
    where: { id: conversacion.id }, select: { telefonoCifrado: true },
  })
  const telefono = conv.telefonoCifrado ? descifrarTelefono(conv.telefonoCifrado) : null

  try {
    const reporte = await crearReporte({
      categoriaId: borrador.categoriaId,
      descripcion: borrador.descripcion,
      // El canal real, no "whatsapp" para todo: si Telegram se contara como
      // WhatsApp, la gráfica de canales del tablero mentiría y el municipio
      // no sabría por dónde le está llegando la gente.
      origen: entrante.canal === 'telegram' ? 'telegram' : 'whatsapp',
      lat: borrador.lat ?? null,
      lng: borrador.lng ?? null,
      coloniaId: borrador.coloniaId ?? null,
      direccionTexto: borrador.direccionTexto ?? null,
      telefono,
      nombreContacto: entrante.nombre ?? null,
      prioridad: borrador.prioridad,
      fotos: borrador.fotos,
    })

    // A dónde avisarle después (Telegram no tiene teléfono necesariamente).
    await prisma.reporte.update({
      where: { id: reporte.id },
      data: {
        canalNotificacion: entrante.canal,
        destinoNotificacion: cifrarTelefono(chatId),
        origen: entrante.canal === 'telegram' ? 'whatsapp' : 'whatsapp',
      },
    })
    await prisma.conversacionBot.update({
      where: { id: conversacion.id }, data: { reporteId: reporte.id },
    })
    await guardarEstado(conversacion.id, { paso: 'menu' })

    return [{
      chatId,
      texto: `✅ Listo. Tu folio es *${reporte.folio}*\n\nNos comprometemos a atenderlo en un máximo de *${reporte.slaDiasHabiles} días hábiles*, o sea a más tardar el ${fecha(reporte.fechaLimite)}.\n\nGuarda tu folio: con él puedes consultar el avance cuando quieras. Te aviso por aquí en cuanto haya novedades.`,
    }]
  } catch (e) {
    if (e instanceof ReglaDeNegocio) {
      await guardarEstado(conversacion.id, { paso: 'menu' })
      return [{ chatId, texto: `No pude registrarlo: ${e.message}\n\nEscribe *menú* para intentar de nuevo.` }]
    }
    throw e
  }
}
