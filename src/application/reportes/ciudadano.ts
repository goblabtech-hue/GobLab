import { prisma } from '@/infrastructure/prisma'
import { cargarFestivos } from '@/infrastructure/festivos'
import { calcularFechaLimite } from '@/domain/dias-habiles'
import { hashTelefono } from '@/domain/telefono'
import { puedeTransicionar } from '@/domain/estatus'
import { CALIFICACION_REAPERTURA, MAX_REAPERTURAS } from '@/infrastructure/config'
import { notificarCiudadano } from '@/application/notificaciones'
import { ReglaDeNegocio, registrarEvento } from './nucleo'

/**
 * Lo que hace el ciudadano al final del ciclo: calificar y, si no quedó bien,
 * pedir que lo revisen otra vez (SPEC §4.2 y §4.3).
 */

// ---------------------------------------------------------------- ciudadano

/**
 * Calificación al cierre (SPEC §4.3). El reporte se cierra en el momento de
 * calificar; si nadie califica, lo cierra el proceso de autocierre a los 3 días.
 */
export async function calificarReporte(
  folio: string, calificacion: number, comentario?: string,
) {
  if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
    throw new ReglaDeNegocio('La calificación va de 1 a 5 estrellas.')
  }

  const r = await prisma.reporte.findUnique({
    where: { folio }, select: { id: true, estatus: true, calificacion: true },
  })
  if (!r) throw new ReglaDeNegocio('No encontramos ese folio.')
  if (r.calificacion !== null) throw new ReglaDeNegocio('Este reporte ya fue calificado.')
  if (r.estatus !== 'resuelto') {
    throw new ReglaDeNegocio('Solo se puede calificar un reporte que ya se resolvió.')
  }

  const cerradoAt = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: r.id },
      data: {
        calificacion,
        comentarioCalificacion: comentario?.trim() || null,
        estatus: 'cerrado',
        cerradoAt,
      },
    })
    await registrarEvento(tx, { reporteId: r.id, tipo: 'calificado', detalle: { calificacion } })
    await registrarEvento(tx, { reporteId: r.id, tipo: 'cerrado', detalle: { automatico: false } })
  })

  return { puedeReabrir: calificacion <= CALIFICACION_REAPERTURA }
}

/**
 * Reapertura a petición del ciudadano, una sola vez y solo si calificó bajo
 * (SPEC §4.2).
 */
export async function reabrirReporte(folio: string, motivo?: string) {
  const r = await prisma.reporte.findUnique({
    where: { folio },
    select: { id: true, estatus: true, calificacion: true, vecesReabierto: true, categoriaId: true },
  })
  if (!r) throw new ReglaDeNegocio('No encontramos ese folio.')
  if (r.vecesReabierto >= MAX_REAPERTURAS) {
    throw new ReglaDeNegocio(
      'Este reporte ya se reabrió una vez. Si el problema sigue, levanta un reporte nuevo.',
    )
  }
  if (!puedeTransicionar(r.estatus, 'reabierto')) {
    throw new ReglaDeNegocio('Este reporte no se puede reabrir.')
  }
  if (r.calificacion === null || r.calificacion > CALIFICACION_REAPERTURA) {
    throw new ReglaDeNegocio(
      'La reapertura es para cuando el trabajo no quedó bien: primero califica el reporte.',
    )
  }

  // DECISIÓN D-11: al reabrir, el plazo vuelve a correr desde hoy.
  // Conservar la fecha límite original dejaría todo reporte reabierto vencido
  // desde el primer segundo: la cuadrilla no tendría un plazo que pueda
  // cumplir, y la tasa de vencidos mediría el pasado en vez del trabajo
  // pendiente. El historial no se pierde: la reapertura queda en la bitácora y
  // alimenta su propio KPI (SPEC §6.6).
  const categoria = await prisma.categoria.findUniqueOrThrow({
    where: { id: r.categoriaId }, select: { slaDiasHabiles: true },
  })
  const festivos = await cargarFestivos()
  const reabiertoAt = new Date()
  const nuevaFechaLimite = calcularFechaLimite(reabiertoAt, categoria.slaDiasHabiles, festivos)

  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: r.id },
      data: {
        estatus: 'reabierto',
        reabiertoAt,
        cerradoAt: null,
        fechaLimite: nuevaFechaLimite,
        // La reapertura vuelve a correr con el plazo VIGENTE, no con el que se
        // prometió hace meses: es trabajo nuevo con el compromiso de hoy.
        slaDiasHabilesAplicado: categoria.slaDiasHabiles,
        vecesReabierto: { increment: 1 },
      },
    })
    await registrarEvento(tx, { reporteId: r.id, tipo: 'reabierto', detalle: {
      motivo: motivo?.trim() || null,
      nuevaFechaLimite: nuevaFechaLimite.toISOString(),
    } })
  })

  await notificarCiudadano(r.id, 'reabierto')
}

/** Reportes ligados a un teléfono, para "consultar mis reportes" del bot. */
export async function reportesDeTelefono(telefono: string) {
  const hash = hashTelefono(telefono)
  return prisma.reporte.findMany({
    where: { OR: [{ telefonoHash: hash }, { adhesiones: { some: { telefonoHash: hash } } }] },
    select: {
      folio: true, estatus: true, createdAt: true, fechaLimite: true,
      categoria: { select: { nombre: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
}
