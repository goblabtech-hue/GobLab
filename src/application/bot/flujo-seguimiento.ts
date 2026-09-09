import { prisma } from '@/infrastructure/prisma'
import {
  agregarFotoCiudadano, agregarNotaCiudadano, rechazarResolucion,
  calificarReporte, MAX_FOTOS_SEGUIMIENTO,
} from '@/application/reportes'
import { ReglaDeNegocio } from '@/application/reportes/nucleo'
import { guardarImagen, ImagenInvalida } from '@/infrastructure/almacenamiento'
import { ESTATUS_ABIERTOS } from '@/domain/estatus'
import { fecha } from '@/domain/formato'
import { proveedor, type MensajeSaliente } from '@/infrastructure/mensajeria'
import { esAfirmativo, esNegativo, type Contexto, type Estado } from './estado'
import { guardarEstado } from './conversacion'

/**
 * Lo que el ciudadano hace con un reporte suyo después de levantarlo:
 * sumarle fotos, sumarle información, y decir si el trabajo quedó bien.
 *
 * Este último es el que cierra el círculo. Antes el sistema avisaba «ya
 * terminamos, califica del 1 al 5» y no había nada escuchando esa respuesta:
 * la persona contestaba al vacío y a los tres días el reporte se autocerraba
 * solo. Un municipio que pregunta y no oye es peor que uno que no pregunta.
 */

// ---------------------------------------------------------------- menú

/** Lo que se puede hacer con un reporte, según cómo esté. */
export async function accionesDeFolio(
  ctx: Contexto, reporteId: string, folio: string, encabezado?: string,
): Promise<MensajeSaliente[]> {
  const r = await prisma.reporte.findUniqueOrThrow({
    where: { id: reporteId }, select: { estatus: true },
  })
  await guardarEstado(ctx.conversacion.id, { paso: 'folio_acciones', reporteId, folio })

  if (r.estatus === 'resuelto') {
    return [{
      chatId: ctx.chatId,
      texto: `${encabezado ? `${encabezado}\n\n` : ''}La cuadrilla marcó este reporte como terminado. ¿Quedó bien?`,
      botones: [
        { id: 'quedo_si', texto: '✅ Sí, quedó' },
        { id: 'quedo_no', texto: '❌ No, sigue igual' },
        { id: 'sumar_foto', texto: '📷 Mandar una foto' },
      ],
    }]
  }

  if (!ESTATUS_ABIERTOS.includes(r.estatus)) {
    await guardarEstado(ctx.conversacion.id, { paso: 'menu' })
    return [{
      chatId: ctx.chatId,
      texto: `${encabezado ? `${encabezado}\n\n` : ''}Este reporte ya está cerrado. Si el problema volvió, escribe *menú* y levanta uno nuevo.`,
    }]
  }

  return [{
    chatId: ctx.chatId,
    texto: `${encabezado ? `${encabezado}\n\n` : ''}¿Quieres agregarle algo?`,
    botones: [
      { id: 'sumar_foto', texto: '📷 Agregar una foto' },
      { id: 'sumar_nota', texto: '✍️ Agregar información' },
      { id: 'op_menu', texto: 'Volver al menú' },
    ],
  }]
}

export async function manejarAccionesFolio(
  ctx: Contexto, estado: Extract<Estado, { paso: 'folio_acciones' }>,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId, clave } = ctx
  const { reporteId, folio } = estado

  // Una foto mandada sin tocar el botón cuenta igual: es lo más natural.
  if (ctx.entrante.mediaUrl) {
    await guardarEstado(conversacion.id, { paso: 'sumando_foto', reporteId, folio })
    return manejarSumarFoto(ctx, { paso: 'sumando_foto', reporteId, folio })
  }

  if (clave === 'sumar_foto' || clave.includes('foto')) {
    await guardarEstado(conversacion.id, { paso: 'sumando_foto', reporteId, folio })
    return [{ chatId, texto: `Mándame la foto y la sumo al folio ${folio}.` }]
  }

  if (clave === 'sumar_nota' || clave.includes('informacion')) {
    await guardarEstado(conversacion.id, { paso: 'sumando_nota', reporteId, folio })
    return [{
      chatId,
      texto: 'Cuéntame qué más sabes: si empeoró, si cambió de lugar, o cualquier dato que le sirva a la cuadrilla.',
    }]
  }

  if (clave === 'quedo_si') return pedirCalificacion(ctx, reporteId, folio)

  if (clave === 'quedo_no') {
    await guardarEstado(conversacion.id, { paso: 'motivo_rechazo', reporteId, folio })
    return [{
      chatId,
      texto: 'Lamento que siga. Cuéntame qué es lo que falta, para que la cuadrilla sepa qué buscar cuando vuelva.',
    }]
  }

  await guardarEstado(conversacion.id, { paso: 'menu' })
  return [{ chatId, texto: 'Escribe *menú* para volver al inicio.' }]
}

// ---------------------------------------------------------------- aportes

export async function manejarSumarFoto(
  ctx: Contexto, estado: Extract<Estado, { paso: 'sumando_foto' }>,
): Promise<MensajeSaliente[]> {
  const { chatId, clave, entrante } = ctx
  const { reporteId, folio } = estado

  if (!entrante.mediaUrl) {
    if (clave === 'listo' || clave === 'seguir' || esNegativo(clave)) {
      return accionesDeFolio(ctx, reporteId, folio)
    }
    return [{ chatId, texto: 'Mándamela como imagen, o escribe *listo* si ya no vas a mandar más.' }]
  }

  try {
    const canal = proveedor(entrante.canal)
    if (!canal.descargarMedia) {
      return [{ chatId, texto: 'Por este canal todavía no puedo recibir fotos. Cuéntamelo con palabras.' }]
    }
    const { buffer, tipo } = await canal.descargarMedia(entrante.mediaUrl)
    const archivo = new File([new Uint8Array(buffer)], 'foto.jpg', { type: tipo })
    const url = await guardarImagen(archivo)
    const { fotos } = await agregarFotoCiudadano(reporteId, url)

    return [{
      chatId,
      texto: `Listo, la sumé al folio ${folio} (${fotos} de ${MAX_FOTOS_SEGUIMIENTO}). Puedes mandar otra o escribir *listo*.`,
      botones: [{ id: 'listo', texto: 'Listo' }],
    }]
  } catch (e) {
    if (e instanceof ReglaDeNegocio || e instanceof ImagenInvalida) {
      return [{ chatId, texto: `${e.message}\n\nEscribe *listo* para volver.` }]
    }
    console.error('[bot] foto de seguimiento:', e)
    return [{ chatId, texto: 'No pude guardar esa foto. Intenta con otra o escribe *listo*.' }]
  }
}

export async function manejarSumarNota(
  ctx: Contexto, estado: Extract<Estado, { paso: 'sumando_nota' }>,
): Promise<MensajeSaliente[]> {
  const { chatId, entrante } = ctx
  const { reporteId, folio } = estado
  try {
    await agregarNotaCiudadano(reporteId, entrante.texto)
  } catch (e) {
    if (e instanceof ReglaDeNegocio) return [{ chatId, texto: e.message }]
    throw e
  }
  return accionesDeFolio(ctx, reporteId, folio, `Anotado en el folio ${folio}. La cuadrilla lo va a ver.`)
}

// ---------------------------------------------------------------- cierre

export async function pedirCalificacion(
  ctx: Contexto, reporteId: string, folio: string,
): Promise<MensajeSaliente[]> {
  await guardarEstado(ctx.conversacion.id, { paso: 'calificando', reporteId, folio })
  return [{
    chatId: ctx.chatId,
    texto: 'Me da gusto. ¿Cómo quedó el trabajo? Del 1 al 5, donde 5 es excelente.',
    botones: [
      { id: '5', texto: '5 ⭐️' }, { id: '4', texto: '4' }, { id: '3', texto: '3' },
      { id: '2', texto: '2' }, { id: '1', texto: '1' },
    ],
  }]
}

export async function manejarCalificacion(
  ctx: Contexto, estado: Extract<Estado, { paso: 'calificando' }>,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId, clave } = ctx
  const n = Number(clave)
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    return [{ chatId, texto: 'Responde con un número del 1 al 5.' }]
  }

  try {
    await calificarReporte(estado.folio, n)
  } catch (e) {
    if (e instanceof ReglaDeNegocio) {
      await guardarEstado(conversacion.id, { paso: 'menu' })
      return [{ chatId, texto: `${e.message}\n\nEscribe *menú* para volver.` }]
    }
    throw e
  }

  await guardarEstado(conversacion.id, { paso: 'menu' })
  return [{
    chatId,
    texto: `Gracias. El folio ${estado.folio} queda cerrado con ${n} de 5.\n\nSi algo más de tu colonia necesita atención, escribe *menú*.`,
  }]
}

export async function manejarMotivoRechazo(
  ctx: Contexto, estado: Extract<Estado, { paso: 'motivo_rechazo' }>,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId, entrante } = ctx
  const motivo = entrante.texto.trim()
  if (motivo.length < 4) {
    return [{ chatId, texto: 'Cuéntame un poco más: ¿qué es lo que sigue mal?' }]
  }

  try {
    const { folio, fechaLimite } = await rechazarResolucion(estado.reporteId, motivo)
    await guardarEstado(conversacion.id, { paso: 'menu' })
    return [{
      chatId,
      texto: `Reabrí el folio ${folio} con lo que me dijiste. La cuadrilla lo vuelve a revisar, con nuevo plazo al ${fecha(fechaLimite)}.\n\nTe aviso por aquí en cuanto haya novedades.`,
    }]
  } catch (e) {
    if (e instanceof ReglaDeNegocio) {
      await guardarEstado(conversacion.id, { paso: 'menu' })
      return [{ chatId, texto: `${e.message}\n\nEscribe *menú* para volver.` }]
    }
    throw e
  }
}

/** Respuesta al aviso de «ya terminamos», que llega con la foto de la cuadrilla. */
export async function manejarConfirmacionResolucion(
  ctx: Contexto, estado: Extract<Estado, { paso: 'confirmando_resolucion' }>,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId, clave } = ctx
  const { reporteId, folio } = estado

  if (clave === 'quedo_si' || esAfirmativo(clave)) return pedirCalificacion(ctx, reporteId, folio)

  if (clave === 'quedo_no' || esNegativo(clave)) {
    await guardarEstado(conversacion.id, { paso: 'motivo_rechazo', reporteId, folio })
    return [{
      chatId,
      texto: 'Lamento que siga. Cuéntame qué es lo que falta, para que la cuadrilla sepa qué buscar cuando vuelva.',
    }]
  }

  // Muchos contestan directamente con la calificación, sin pasar por el sí.
  const n = Number(clave)
  if (Number.isInteger(n) && n >= 1 && n <= 5) {
    await guardarEstado(conversacion.id, { paso: 'calificando', reporteId, folio })
    return manejarCalificacion(ctx, { paso: 'calificando', reporteId, folio })
  }

  return [{
    chatId,
    texto: `¿Quedó resuelto el folio ${folio}?`,
    botones: [
      { id: 'quedo_si', texto: '✅ Sí, quedó' },
      { id: 'quedo_no', texto: '❌ No, sigue igual' },
    ],
  }]
}
