import { prisma } from '@/infrastructure/prisma'
import { obtenerConfiguracion } from '@/infrastructure/config'
import { ESTATUS } from '@/domain/presentacion'
import { fecha } from '@/domain/formato'
import type { MensajeSaliente } from '@/infrastructure/mensajeria'
import type { Conversacion } from './conversacion'
import { guardarEstado } from './conversacion'
import { accionesDeFolio } from './flujo-seguimiento'
import type { Contexto } from './estado'

/**
 * Consulta de folio y escalamiento a una persona (SPEC §4.1).
 */

// ---------------------------------------------------------------- folio

export async function iniciarConsultaFolio(
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
      // Se queda esperando folio, no en el menú: un folio tiene 14 caracteres
      // y en el menú se habría tomado por la descripción de un reporte nuevo.
      await guardarEstado(conversacion.id, { paso: 'pidiendo_folio' })
      const lista = reportes
        .map((r) => `• *${r.folio}* — ${r.categoria.nombre}\n  ${ESTATUS[r.estatus].ciudadano} · ${fecha(r.createdAt)}`)
        .join('\n\n')
      return [{ chatId, texto: `Estos son tus reportes:\n\n${lista}\n\nEscribe un folio si quieres el detalle, o *menú* para volver.` }]
    }
  }

  await guardarEstado(conversacion.id, { paso: 'pidiendo_folio' })
  return [{ chatId, texto: 'Escribe tu folio. Se ve así: MUN-2026-00341' }]
}

export async function manejarFolio(
  ctx: Contexto, texto: string,
): Promise<MensajeSaliente[]> {
  const { conversacion, chatId } = ctx
  const folio = texto.trim().toUpperCase()

  const reporte = await prisma.reporte.findUnique({
    where: { folio },
    select: {
      id: true, folio: true, estatus: true, createdAt: true, fechaLimite: true,
      resueltoAt: true, notaCierre: true,
      categoria: { select: { nombre: true } },
      colonia: { select: { nombre: true } },
      _count: { select: { fotos: { where: { tipo: 'ciudadano' } } } },
    },
  })

  if (!reporte) {
    return [{ chatId, texto: 'No encontré ese folio. Revísalo y vuelve a escribirlo, o escribe *menú*.' }]
  }

  const info = ESTATUS[reporte.estatus]
  const abierto = ['nuevo', 'asignado', 'en_atencion', 'reabierto'].includes(reporte.estatus)

  const resumen = [
    `*${reporte.folio}* — ${reporte.categoria.nombre}`,
    reporte.colonia ? `Col. ${reporte.colonia.nombre}` : null,
    '',
    `*${info.ciudadano}*`,
    info.explicacion,
    '',
    `Recibido el ${fecha(reporte.createdAt)}.`,
    abierto ? `Plazo comprometido: ${fecha(reporte.fechaLimite)}.` : null,
    reporte.resueltoAt ? `Terminado el ${fecha(reporte.resueltoAt)}.` : null,
    reporte.notaCierre ? `\n«${reporte.notaCierre}»` : null,
    reporte._count.fotos ? `${reporte._count.fotos} foto(s) tuyas.` : null,
  ].filter((l) => l !== null).join('\n')

  // Se ofrece qué hacer con él, no solo el estado: un reporte no es una
  // fotografía. La fuga crece, aparece otra evidencia, o el vecino se acuerda
  // de un dato. Sin esto, la única forma de aportarlo sería levantar otro
  // reporte, y el municipio acabaría con duplicados que nadie relaciona.
  await guardarEstado(conversacion.id, {
    paso: 'folio_acciones', reporteId: reporte.id, folio: reporte.folio,
  })
  return accionesDeFolio(ctx, reporte.id, reporte.folio, resumen)
}

// ---------------------------------------------------------------- humano

export async function escalar(
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
