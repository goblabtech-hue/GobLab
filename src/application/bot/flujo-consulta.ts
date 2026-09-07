import { prisma } from '@/infrastructure/prisma'
import { obtenerConfiguracion } from '@/infrastructure/config'
import { ESTATUS } from '@/domain/presentacion'
import { fecha } from '@/domain/formato'
import type { MensajeSaliente } from '@/infrastructure/mensajeria'
import type { Conversacion } from './conversacion'
import { guardarEstado } from './conversacion'

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

export async function manejarFolio(
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
