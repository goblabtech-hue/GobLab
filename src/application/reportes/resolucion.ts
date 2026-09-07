import { prisma } from '@/infrastructure/prisma'
import { puedeTransicionar } from '@/domain/estatus'
import { notificarCiudadano } from '@/application/notificaciones'
import { ReglaDeNegocio, registrarEvento } from './nucleo'

/**
 * Cierre del trabajo de campo y moderación de la galería (SPEC §4.3 y §4.4f).
 */

// ---------------------------------------------------------------- resolución

/**
 * Cierra el trabajo de campo. Exige al menos una foto de evidencia salvo que
 * la categoría esté marcada con `requiereEvidencia = false` (SPEC §5).
 */
export type DatosResolucion = {
  reporteId: string
  userId: string
  fotosEvidencia: string[]
  notaCierre?: string
}

export async function resolverReporte(datos: DatosResolucion) {
  const { reporteId, userId, fotosEvidencia, notaCierre } = datos
  const r = await prisma.reporte.findUnique({
    where: { id: reporteId },
    select: {
      estatus: true, folio: true,
      categoria: { select: { requiereEvidencia: true } },
      fotos: { where: { tipo: 'evidencia' }, select: { id: true } },
    },
  })
  if (!r) throw new ReglaDeNegocio('Reporte no encontrado.')
  if (!puedeTransicionar(r.estatus, 'resuelto')) {
    throw new ReglaDeNegocio('Ese reporte no se puede marcar como resuelto.')
  }

  const evidenciaTotal = r.fotos.length + fotosEvidencia.length
  if (r.categoria.requiereEvidencia && evidenciaTotal === 0) {
    throw new ReglaDeNegocio(
      'Sube al menos una foto del trabajo terminado antes de marcarlo como resuelto.',
    )
  }

  const resueltoAt = new Date()
  await prisma.$transaction(async (tx) => {
    if (fotosEvidencia.length) {
      await tx.fotoReporte.createMany({
        data: fotosEvidencia.map((url) => ({
          reporteId, url, tipo: 'evidencia' as const, subidaPorUserId: userId,
        })),
      })
    }
    await tx.reporte.update({
      where: { id: reporteId },
      data: { estatus: 'resuelto', resueltoAt, notaCierre: notaCierre?.trim() || null },
    })
    await registrarEvento(tx, { reporteId: reporteId, tipo: 'resuelto', detalle: { evidencias: evidenciaTotal }, userId: userId })
  })

  // Fuera de la transacción a propósito: si el proveedor de mensajería está
  // caído, el reporte igual queda resuelto.
  await notificarCiudadano(reporteId, 'resuelto')

  return { folio: r.folio, resueltoAt }
}

/**
 * Autoriza (o retira) un reporte para la galería pública antes/después.
 *
 * SPEC §4.4f: solo se publican reportes «marcados como publicables por un
 * supervisor». La moderación existe porque las fotos las toma el ciudadano con
 * su celular y pueden traer placas, fachadas, menores o el interior de una
 * casa. Sin esta revisión, publicar la galería sería exponer a la gente que
 * confió en el sistema.
 *
 * Se exige que haya las dos fotos: una galería de «antes y después» con una
 * sola imagen no muestra nada.
 */
export async function moderarPublicacion(
  reporteId: string, publicable: boolean, userId: string,
) {
  const r = await prisma.reporte.findUnique({
    where: { id: reporteId },
    select: {
      estatus: true, resueltoAt: true,
      fotos: { select: { tipo: true } },
    },
  })
  if (!r) throw new ReglaDeNegocio('Reporte no encontrado.')

  if (publicable) {
    if (!r.resueltoAt) {
      throw new ReglaDeNegocio('Solo se publican reportes que ya se resolvieron.')
    }
    const tieneAntes = r.fotos.some((f) => f.tipo === 'ciudadano')
    const tieneDespues = r.fotos.some((f) => f.tipo === 'evidencia')
    if (!tieneAntes || !tieneDespues) {
      throw new ReglaDeNegocio(
        'Para la galería hacen falta las dos fotos: la del ciudadano y la de la cuadrilla.',
      )
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({ where: { id: reporteId }, data: { publicable } })
    await registrarEvento(tx, { reporteId: reporteId, tipo: 'publicable', detalle: { publicable }, userId: userId })
  })
}
