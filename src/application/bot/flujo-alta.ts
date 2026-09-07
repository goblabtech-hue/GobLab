import { prisma } from '@/infrastructure/prisma'
import { obtenerConfiguracion } from '@/infrastructure/config'
import { clasificar, hayClasificadorIA, CONFIANZA_MINIMA } from './clasificador'
import { CATEGORIAS_POR_PAGINA, type Borrador, type Contexto, type Estado } from './estado'
import { guardarEstado } from './conversacion'
import { pedirFoto } from './flujo-evidencia'
import { escalar, iniciarConsultaFolio } from './flujo-consulta'
import type { MensajeSaliente } from '@/infrastructure/mensajeria'

/**
 * Primeros pasos del alta por chat: menú, descripción en lenguaje natural y
 * elección de categoría (SPEC §4.1).
 */

// ---------------------------------------------------------------- pasos

export async function menuPrincipal(chatId: string, nombre?: string): Promise<MensajeSaliente> {
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

export async function manejarMenu(ctx: Contexto): Promise<MensajeSaliente[]> {
  const { conversacion, chatId, clave, entrante } = ctx
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
    return manejarDescripcion(ctx, entrante.texto.trim())
  }

  return [await menuPrincipal(chatId, entrante.nombre)]
}

export async function manejarDescripcion(
  ctx: Contexto, texto: string,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId } = ctx
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
    return mostrarCategorias(ctx, { borrador, pagina: 0, encabezado:
      hayClasificadorIA()
        ? 'Para no equivocarme, dime qué se parece más a tu problema:'
        : 'Gracias. ¿Cuál de estos se parece más a tu problema?' })
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
    return mostrarCategorias(ctx, { borrador, pagina: 0, encabezado: '¿Cuál se parece más a tu problema?' })
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

export type VistaCategorias = { borrador: Borrador; pagina: number; encabezado: string }

export async function mostrarCategorias(
  ctx: Contexto, vista: VistaCategorias,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId } = ctx
  const { borrador, pagina, encabezado } = vista
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

export async function manejarConfirmacionCategoria(
  ctx: Contexto, estado: Extract<Estado, { paso: 'confirmando_categoria' }>,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId, clave } = ctx
  if (clave === 'si' || clave === 's' || clave === '1' || clave.startsWith('si')) {
    const borrador = { ...estado.borrador, categoriaId: estado.categoriaPropuesta }
    return pedirFoto(conversacion, chatId, borrador)
  }
  if (clave === 'no' || clave === 'n' || clave === '2') {
    return mostrarCategorias(ctx, { borrador: estado.borrador, pagina: 0, encabezado: 'Sin problema. ¿Cuál se parece más?' })
  }
  return [{ chatId, texto: 'Responde *sí* o *no*, por favor.' }]
}

export async function manejarEleccionCategoria(
  ctx: Contexto, estado: Extract<Estado, { paso: 'eligiendo_categoria' }>,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId, clave } = ctx
  if (clave === 'mas' || clave === '+') {
    return mostrarCategorias(ctx, { borrador: estado.borrador, pagina: estado.pagina + 1, encabezado: 'Otras opciones:' })
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
