import { prisma } from '@/infrastructure/prisma'
import { DIAS_AUTOCIERRE } from '@/infrastructure/config'
import { registrarEvento } from './nucleo'

/**
 * Tareas que corren solas sobre los reportes (SPEC §4.3).
 */

// ---------------------------------------------------------------- autocierre

/**
 * Cierra los reportes resueltos que llevan más de 3 días sin calificación
 * (SPEC §4.3). Lo dispara /api/cron/autocierre (corrección C-07).
 */
export async function autocerrarResueltos(ahora = new Date()) {
  const limite = new Date(ahora.getTime() - DIAS_AUTOCIERRE * 24 * 60 * 60 * 1000)

  const pendientes = await prisma.reporte.findMany({
    where: { estatus: 'resuelto', resueltoAt: { lte: limite } },
    select: { id: true },
  })

  for (const { id } of pendientes) {
    await prisma.$transaction(async (tx) => {
      await tx.reporte.update({
        where: { id },
        data: { estatus: 'cerrado', cerradoAt: ahora },
      })
      await registrarEvento(tx, { reporteId: id, tipo: 'cerrado', detalle: { automatico: true, diasSinRespuesta: DIAS_AUTOCIERRE } })
    })
  }

  return pendientes.length
}
