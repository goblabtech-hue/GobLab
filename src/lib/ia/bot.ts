import { prisma } from '@/lib/prisma'
import { obtenerConfiguracion } from '@/lib/config'
import { crearReporte, posiblesDuplicados, adherirse, ReglaDeNegocio } from '@/lib/reportes'
import { derivarTelefono, hashTelefono, cifrarTelefono, telefonoValido } from '@/lib/telefono'
import { guardarImagen, ImagenInvalida, MAX_FOTOS_CIUDADANO } from '@/lib/storage'
import { ESTATUS } from '@/lib/presentacion'
import { fecha } from '@/lib/utils'
import { clasificar, hayClasificadorIA, pareceEmergencia, CONFIANZA_MINIMA } from './clasificador'
import { proveedor, type MensajeEntrante, type MensajeSaliente } from '@/lib/mensajeria'
import type { Prioridad } from '@/generated/prisma/enums'

/**
 * Motor conversacional del bot (SPEC §4.1).
 *
 * Es agnóstico del canal: recibe `MensajeEntrante` y devuelve
 * `MensajeSaliente`. WhatsApp, Telegram y el simulador comparten exactamente
 * este flujo — por eso agregar Telegram no obligó a tocarlo.
 *
 * El estado de la conversación vive en la base (`ConversacionBot.estado`), no
 * en memoria: un bot que olvida en qué paso iba cada vez que se reinicia el
 * servidor es inservible.
 */

type Borrador = {
  descripcion: string
  categoriaId?: number
  prioridad?: Prioridad
  fotos: string[]
  lat?: number
  lng?: number
  coloniaId?: number
  coloniaNombre?: string
  direccionTexto?: string
  resumen?: string
}

type Estado =
  | { paso: 'inicio' }
  | { paso: 'menu' }
  | { paso: 'describiendo' }
  | { paso: 'confirmando_categoria'; borrador: Borrador; categoriaPropuesta: number }
  | { paso: 'eligiendo_categoria'; borrador: Borrador; pagina: number }
  | { paso: 'pidiendo_foto'; borrador: Borrador }
  | { paso: 'pidiendo_ubicacion'; borrador: Borrador }
  | { paso: 'eligiendo_colonia'; borrador: Borrador; pagina: number }
  | { paso: 'confirmando'; borrador: Borrador }
  | { paso: 'ofreciendo_adhesion'; borrador: Borrador; reporteId: string; folio: string }
  | { paso: 'pidiendo_folio' }
  | { paso: 'escalado' }

const CATEGORIAS_POR_PAGINA = 8

/** Cualquiera de estas devuelve al menú desde donde sea. */
const PALABRAS_MENU = ['menu', 'menú', 'inicio', 'cancelar', 'salir', 'start', '/start', '0']
const PALABRAS_HUMANO = ['humano', 'persona', 'operador', 'asesor', 'hablar con alguien', 'agente']

const normalizar = (t: string) =>
  t.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

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

async function obtenerConversacion(entrante: MensajeEntrante) {
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

async function guardarEstado(id: string, estado: Estado, extra: Record<string, unknown> = {}) {
  await prisma.conversacionBot.update({
    where: { id },
    data: { estado: estado as never, ...extra },
  })
}

// ---------------------------------------------------------------- flujo

type Conversacion = Awaited<ReturnType<typeof obtenerConversacion>>

async function responder(
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

  switch (estado.paso) {
    case 'inicio':
      await guardarEstado(conversacion.id, { paso: 'menu' })
      return [await menuPrincipal(chatId, entrante.nombre)]

    case 'menu':
      return manejarMenu(conversacion, chatId, clave, entrante)

    case 'describiendo':
      return manejarDescripcion(conversacion, chatId, texto)

    case 'confirmando_categoria':
      return manejarConfirmacionCategoria(conversacion, chatId, clave, estado)

    case 'eligiendo_categoria':
      return manejarEleccionCategoria(conversacion, chatId, clave, estado)

    case 'pidiendo_foto':
      return manejarFoto(conversacion, chatId, clave, estado, entrante)

    case 'pidiendo_ubicacion':
      return manejarUbicacion(conversacion, chatId, estado, entrante)

    case 'eligiendo_colonia':
      return manejarColonia(conversacion, chatId, clave, estado)

    case 'confirmando':
      return manejarConfirmacion(conversacion, chatId, clave, estado, entrante)

    case 'ofreciendo_adhesion':
      return manejarAdhesion(conversacion, chatId, clave, estado)

    case 'pidiendo_folio':
      return manejarFolio(conversacion, chatId, texto)

    default:
      await guardarEstado(conversacion.id, { paso: 'menu' })
      return [await menuPrincipal(chatId, entrante.nombre)]
  }
}

// ---------------------------------------------------------------- pasos

async function menuPrincipal(chatId: string, nombre?: string): Promise<MensajeSaliente> {
  const saludo = nombre ? `¡Hola, ${nombre}!` : '¡Hola!'
  const cfg = await obtenerConfiguracion()
  return {
    chatId,
    texto: `${saludo} Soy el asistente de ${cfg.nombre}. ¿Qué necesitas?\n\n1️⃣ Reportar un problema\n2️⃣ Consultar mi folio\n3️⃣ Información del municipio\n4️⃣ Hablar con una persona\n\nEscribe el número o dime directamente qué pasa.`,
    botones: [
      { id: 'op_reportar', texto: 'Reportar' },
      { id: 'op_folio', texto: 'Mi folio' },
      { id: 'op_humano', texto: 'Hablar con alguien' },
    ],
  }
}

async function manejarMenu(
  conversacion: Conversacion, chatId: string, clave: string, entrante: MensajeEntrante,
): Promise<MensajeSaliente[]> {
  if (clave === '1' || clave === 'op_reportar' || clave.includes('reportar')) {
    await guardarEstado(conversacion.id, { paso: 'describiendo' })
    return [{
      chatId,
      texto: 'Cuéntame qué está pasando, con tus palabras. Por ejemplo: «hay un bache enorme frente a la escuela, ya se ponchó una llanta».',
    }]
  }

  if (clave === '2' || clave === 'op_folio' || clave.includes('folio')) {
    return iniciarConsultaFolio(conversacion, chatId)
  }

  if (clave === '3' || clave.includes('informacion')) {
    const cfg = await obtenerConfiguracion()
    return [{
      chatId,
      texto: `Sobre ${cfg.nombre}:\n\n• Reportar y dar seguimiento: por aquí mismo, o en el sitio del municipio.\n• Consulta el tablero público para ver cuánto tardamos en atender cada tipo de problema.\n• Emergencias: ${cfg.telEmergencias}. No las atendemos por chat.\n\nEscribe *menú* para volver.`,
    }]
  }

  if (clave === '4') return escalar(conversacion.id, chatId, 'lo pidió el ciudadano')

  // No eligió opción: probablemente ya está contando su problema.
  if (entrante.texto.trim().length >= 10) {
    return manejarDescripcion(conversacion, chatId, entrante.texto.trim())
  }

  return [await menuPrincipal(chatId, entrante.nombre)]
}

async function manejarDescripcion(
  conversacion: Conversacion, chatId: string, texto: string,
): Promise<MensajeSaliente[]> {
  if (texto.length < 10) {
    return [{ chatId, texto: 'Cuéntame un poco más para poder ayudarte: ¿qué es y dónde está?' }]
  }

  const borrador: Borrador = { descripcion: texto, fotos: [] }
  const resultado = await clasificar(texto)

  if (resultado.esEmergencia) {
    return escalar(conversacion.id, chatId, 'el clasificador detectó una emergencia')
  }

  // Sin IA, o con poca confianza: menú de categorías (SPEC §4.1, criterio 2).
  if (resultado.usoFallback || resultado.categoriaId === null || resultado.confianza < CONFIANZA_MINIMA) {
    borrador.prioridad = resultado.prioridad
    return mostrarCategorias(conversacion, chatId, borrador, 0,
      hayClasificadorIA()
        ? 'Para no equivocarme, dime qué se parece más a tu problema:'
        : 'Gracias. ¿Cuál de estos se parece más a tu problema?')
  }

  borrador.prioridad = resultado.prioridad
  borrador.resumen = resultado.resumen
  if (resultado.coloniaDetectada) {
    const colonia = await prisma.colonia.findFirst({
      where: { nombre: resultado.coloniaDetectada }, select: { id: true, nombre: true },
    })
    if (colonia) {
      borrador.coloniaId = colonia.id
      borrador.coloniaNombre = colonia.nombre
    }
  }

  const categoria = await prisma.categoria.findUnique({
    where: { id: resultado.categoriaId }, select: { nombre: true, slaDiasHabiles: true },
  })
  if (!categoria) {
    return mostrarCategorias(conversacion, chatId, borrador, 0, '¿Cuál se parece más a tu problema?')
  }

  await guardarEstado(conversacion.id, {
    paso: 'confirmando_categoria', borrador, categoriaPropuesta: resultado.categoriaId,
  })

  return [{
    chatId,
    texto: `Entendí que se trata de: *${categoria.nombre}*.\n\n¿Es correcto?`,
    botones: [
      { id: 'si', texto: 'Sí, es eso' },
      { id: 'no', texto: 'No, es otra cosa' },
    ],
  }]
}

async function mostrarCategorias(
  conversacion: Conversacion, chatId: string, borrador: Borrador, pagina: number, encabezado: string,
): Promise<MensajeSaliente[]> {
  const categorias = await prisma.categoria.findMany({
    where: { activa: true }, orderBy: { orden: 'asc' }, select: { id: true, nombre: true },
  })
  const inicio = pagina * CATEGORIAS_POR_PAGINA
  const pagActual = categorias.slice(inicio, inicio + CATEGORIAS_POR_PAGINA)
  const hayMas = inicio + CATEGORIAS_POR_PAGINA < categorias.length

  await guardarEstado(conversacion.id, { paso: 'eligiendo_categoria', borrador, pagina })

  const lista = pagActual.map((c, i) => `${inicio + i + 1}. ${c.nombre}`).join('\n')
  return [{
    chatId,
    texto: `${encabezado}\n\n${lista}${hayMas ? '\n\nEscribe *más* para ver otras opciones.' : ''}\n\nResponde con el número.`,
  }]
}

async function manejarConfirmacionCategoria(
  conversacion: Conversacion, chatId: string, clave: string,
  estado: Extract<Estado, { paso: 'confirmando_categoria' }>,
): Promise<MensajeSaliente[]> {
  if (clave === 'si' || clave === 's' || clave === '1' || clave.startsWith('si')) {
    const borrador = { ...estado.borrador, categoriaId: estado.categoriaPropuesta }
    return pedirFoto(conversacion, chatId, borrador)
  }
  if (clave === 'no' || clave === 'n' || clave === '2') {
    return mostrarCategorias(conversacion, chatId, estado.borrador, 0, 'Sin problema. ¿Cuál se parece más?')
  }
  return [{ chatId, texto: 'Responde *sí* o *no*, por favor.' }]
}

async function manejarEleccionCategoria(
  conversacion: Conversacion, chatId: string, clave: string,
  estado: Extract<Estado, { paso: 'eligiendo_categoria' }>,
): Promise<MensajeSaliente[]> {
  if (clave === 'mas' || clave === '+') {
    return mostrarCategorias(conversacion, chatId, estado.borrador, estado.pagina + 1, 'Otras opciones:')
  }

  const n = Number(clave)
  const categorias = await prisma.categoria.findMany({
    where: { activa: true }, orderBy: { orden: 'asc' }, select: { id: true, nombre: true },
  })
  const elegida = Number.isInteger(n) ? categorias[n - 1] : undefined
  if (!elegida) {
    return [{ chatId, texto: 'No reconocí ese número. Responde con el número de la lista.' }]
  }

  const borrador = { ...estado.borrador, categoriaId: elegida.id }
  return pedirFoto(conversacion, chatId, borrador)
}

async function pedirFoto(
  conversacion: Conversacion, chatId: string, borrador: Borrador,
): Promise<MensajeSaliente[]> {
  await guardarEstado(conversacion.id, { paso: 'pidiendo_foto', borrador })
  return [{
    chatId,
    texto: '¿Tienes una foto? Mándala y ayuda mucho a la cuadrilla a saber qué llevar.\n\nSi no tienes, escribe *seguir*.',
    botones: [{ id: 'seguir', texto: 'Seguir sin foto' }],
  }]
}

async function manejarFoto(
  conversacion: Conversacion, chatId: string, clave: string,
  estado: Extract<Estado, { paso: 'pidiendo_foto' }>, entrante: MensajeEntrante,
): Promise<MensajeSaliente[]> {
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

async function pedirUbicacion(
  conversacion: Conversacion, chatId: string, borrador: Borrador,
): Promise<MensajeSaliente[]> {
  await guardarEstado(conversacion.id, { paso: 'pidiendo_ubicacion', borrador })
  return [{
    chatId,
    texto: '¿Dónde está el problema? Puedes mandarme tu ubicación, o escribir la calle y la colonia.',
    pedirUbicacion: true,
  }]
}

async function manejarUbicacion(
  conversacion: Conversacion, chatId: string,
  estado: Extract<Estado, { paso: 'pidiendo_ubicacion' }>, entrante: MensajeEntrante,
): Promise<MensajeSaliente[]> {
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

  return mostrarColonias(conversacion, chatId, borrador, 0)
}

async function mostrarColonias(
  conversacion: Conversacion, chatId: string, borrador: Borrador, pagina: number,
): Promise<MensajeSaliente[]> {
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

async function manejarColonia(
  conversacion: Conversacion, chatId: string, clave: string,
  estado: Extract<Estado, { paso: 'eligiendo_colonia' }>,
): Promise<MensajeSaliente[]> {
  if (clave === 'mas' || clave === '+') {
    return mostrarColonias(conversacion, chatId, estado.borrador, estado.pagina + 1)
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
async function revisarDuplicados(
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

async function manejarAdhesion(
  conversacion: Conversacion, chatId: string, clave: string,
  estado: Extract<Estado, { paso: 'ofreciendo_adhesion' }>,
): Promise<MensajeSaliente[]> {
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
      const { descifrarTelefono } = await import('@/lib/telefono')
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

async function pedirConfirmacion(
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

async function manejarConfirmacion(
  conversacion: Conversacion, chatId: string, clave: string,
  estado: Extract<Estado, { paso: 'confirmando' }>, entrante: MensajeEntrante,
): Promise<MensajeSaliente[]> {
  if (clave === 'no' || clave === 'n' || clave === '2' || clave.includes('cancel')) {
    await guardarEstado(conversacion.id, { paso: 'menu' })
    return [{ chatId, texto: 'Listo, no lo mandé. Escribe *menú* cuando quieras empezar de nuevo.' }]
  }
  if (!(clave === 'si' || clave === 's' || clave === '1' || clave.startsWith('si'))) {
    return [{ chatId, texto: 'Responde *sí* para enviarlo o *no* para cancelar.' }]
  }

  const borrador = estado.borrador
  if (!borrador.categoriaId) {
    return mostrarCategorias(conversacion, chatId, borrador, 0, '¿Cuál se parece más a tu problema?')
  }

  const conv = await prisma.conversacionBot.findUniqueOrThrow({
    where: { id: conversacion.id }, select: { telefonoCifrado: true },
  })
  const { descifrarTelefono } = await import('@/lib/telefono')
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

// ---------------------------------------------------------------- folio

async function iniciarConsultaFolio(
  conversacion: Conversacion, chatId: string,
): Promise<MensajeSaliente[]> {
  const conv = await prisma.conversacionBot.findUniqueOrThrow({
    where: { id: conversacion.id }, select: { telefonoHash: true },
  })

  if (conv.telefonoHash) {
    const reportes = await prisma.reporte.findMany({
      where: { telefonoHash: conv.telefonoHash },
      orderBy: { createdAt: 'desc' }, take: 5,
      select: { folio: true, estatus: true, createdAt: true, categoria: { select: { nombre: true } } },
    })
    if (reportes.length) {
      await guardarEstado(conversacion.id, { paso: 'menu' })
      const lista = reportes
        .map((r) => `• *${r.folio}* — ${r.categoria.nombre}\n  ${ESTATUS[r.estatus].ciudadano} · ${fecha(r.createdAt)}`)
        .join('\n\n')
      return [{ chatId, texto: `Estos son tus reportes:\n\n${lista}\n\nEscribe un folio si quieres el detalle, o *menú* para volver.` }]
    }
  }

  await guardarEstado(conversacion.id, { paso: 'pidiendo_folio' })
  return [{ chatId, texto: 'Escribe tu folio. Se ve así: MUN-2026-00341' }]
}

async function manejarFolio(
  conversacion: Conversacion, chatId: string, texto: string,
): Promise<MensajeSaliente[]> {
  const folio = texto.trim().toUpperCase()

  const reporte = await prisma.reporte.findUnique({
    where: { folio },
    select: {
      folio: true, estatus: true, createdAt: true, fechaLimite: true, resueltoAt: true,
      categoria: { select: { nombre: true } },
      colonia: { select: { nombre: true } },
    },
  })

  if (!reporte) {
    return [{ chatId, texto: 'No encontré ese folio. Revísalo y vuelve a escribirlo, o escribe *menú*.' }]
  }

  await guardarEstado(conversacion.id, { paso: 'menu' })
  const info = ESTATUS[reporte.estatus]
  const abierto = ['nuevo', 'asignado', 'en_atencion', 'reabierto'].includes(reporte.estatus)

  return [{
    chatId,
    texto: `*${reporte.folio}* — ${reporte.categoria.nombre}\n${reporte.colonia ? `Col. ${reporte.colonia.nombre}\n` : ''}\n*${info.ciudadano}*\n${info.explicacion}\n\nRecibido el ${fecha(reporte.createdAt)}.${abierto ? `\nPlazo comprometido: ${fecha(reporte.fechaLimite)}.` : ''}${reporte.resueltoAt ? `\nTerminado el ${fecha(reporte.resueltoAt)}.` : ''}\n\nEscribe *menú* para volver.`,
  }]
}

// ---------------------------------------------------------------- humano

async function escalar(
  conversacionId: string, chatId: string, motivo: string,
): Promise<MensajeSaliente[]> {
  await guardarEstado(conversacionId, { paso: 'escalado' }, { escaladaAHumano: true })
  const cfg = await obtenerConfiguracion()

  await prisma.mensajeBot.create({
    data: { conversacionId, direccion: 'out', texto: `[escalado: ${motivo}]` },
  }).catch(() => {})

  return [{
    chatId,
    texto: `⚠️ *Si hay riesgo para alguien, marca ahora al ${cfg.telEmergencias}.* Ese número atiende las 24 horas; por este chat no podemos responder una emergencia.\n\nYa avisé a una persona del municipio para que retome esta conversación. Te contesta en cuanto pueda.`,
  }]
}

export { type MensajeSaliente }
