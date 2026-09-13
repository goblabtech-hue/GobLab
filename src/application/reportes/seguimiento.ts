import { prisma } from '@/infrastructure/prisma'
import { MAX_REAPERTURAS } from '@/infrastructure/config'
import { ESTATUS_ABIERTOS, puedeTransicionar } from '@/domain/estatus'
import { calcularFechaLimite } from '@/domain/dias-habiles'
import { cargarFestivos } from '@/infrastructure/festivos'
import { ReglaDeNegocio, registrarEvento } from './nucleo'
import { notificarCiudadano } from '@/application/notificaciones'
import { avisarArea, avisarUsuario } from '@/application/avisos-personal'

/**
 * Lo que el ciudadano puede hacer con un reporte que ya levantó.
 *
 * Hasta aquí, consultar un folio era solo leer. Pero un reporte no es una
 * fotografía: la fuga crece, aparece otra evidencia, o el vecino se acuerda de
 * un dato que ayuda a la cuadrilla a saber qué llevar. Si la única forma de
 * aportar eso es levantar OTRO reporte, el municipio termina con duplicados
 * que nadie relaciona entre sí.
 */

/** Cuántas fotos puede sumar después, además de las del alta. */
export const MAX_FOTOS_SEGUIMIENTO = 6

export async function agregarFotoCiudadano(reporteId: string, url: string) {
  const r = await prisma.reporte.findUnique({
    where: { id: reporteId },
    select: {
      estatus: true,
      _count: { select: { fotos: { where: { tipo: 'ciudadano' } } } },
    },
  })
  if (!r) throw new ReglaDeNegocio('No encontramos ese reporte.')
  if (!ESTATUS_ABIERTOS.includes(r.estatus) && r.estatus !== 'resuelto') {
    throw new ReglaDeNegocio('Este reporte ya está cerrado. Si el problema volvió, levanta uno nuevo.')
  }
  if (r._count.fotos >= MAX_FOTOS_SEGUIMIENTO) {
    throw new ReglaDeNegocio(
      `Ya tiene ${MAX_FOTOS_SEGUIMIENTO} fotos tuyas, que es el máximo. Si hace falta algo más, escríbelo.`,
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.fotoReporte.create({ data: { reporteId, url, tipo: 'ciudadano' } })
    await registrarEvento(tx, {
      reporteId, tipo: 'comentario',
      detalle: { origen: 'ciudadano', accion: 'foto_agregada' },
    })
  })

  return { fotos: r._count.fotos + 1 }
}

/**
 * Información que el ciudadano suma después.
 *
 * Se guarda como evento y no pisando la descripción original: lo que la
 * persona dijo al levantar el reporte es parte del expediente, y sobrescribirlo
 * borraría el porqué de las decisiones que ya se tomaron sobre él.
 */
export async function agregarNotaCiudadano(reporteId: string, texto: string) {
  const limpio = texto.trim()
  if (limpio.length < 4) throw new ReglaDeNegocio('Cuéntame un poco más.')
  if (limpio.length > 1000) throw new ReglaDeNegocio('Es demasiado largo; resúmelo un poco.')

  const r = await prisma.reporte.findUnique({ where: { id: reporteId }, select: { estatus: true } })
  if (!r) throw new ReglaDeNegocio('No encontramos ese reporte.')
  if (!ESTATUS_ABIERTOS.includes(r.estatus) && r.estatus !== 'resuelto') {
    throw new ReglaDeNegocio('Este reporte ya está cerrado. Si el problema volvió, levanta uno nuevo.')
  }

  await prisma.$transaction(async (tx) => {
    await registrarEvento(tx, {
      reporteId, tipo: 'comentario',
      detalle: { origen: 'ciudadano', texto: limpio },
    })
  })
}

/**
 * El ciudadano dice que el trabajo NO quedó.
 *
 * Reabre sin exigir calificación previa. La regla que sí la exige
 * (`reabrirReporte`) protege contra reabrir un trabajo bien calificado; aquí
 * no hay calificación que contradecir: la persona está diciendo, mirando la
 * foto de la cuadrilla, que su problema sigue ahí. Eso es evidencia más
 * fuerte que una estrella.
 */
export async function rechazarResolucion(reporteId: string, motivo: string) {
  const r = await prisma.reporte.findUnique({
    where: { id: reporteId },
    select: { id: true, folio: true, estatus: true, vecesReabierto: true, categoriaId: true },
  })
  if (!r) throw new ReglaDeNegocio('No encontramos ese reporte.')
  if (r.estatus !== 'resuelto') {
    throw new ReglaDeNegocio('Este reporte no está esperando tu confirmación.')
  }
  if (r.vecesReabierto >= MAX_REAPERTURAS) {
    throw new ReglaDeNegocio(
      'Este reporte ya se reabrió una vez. Si el problema sigue, levanta uno nuevo y lo revisamos con otros ojos.',
    )
  }
  if (!puedeTransicionar(r.estatus, 'reabierto')) {
    throw new ReglaDeNegocio('Este reporte no se puede reabrir.')
  }

  const categoria = await prisma.categoria.findUniqueOrThrow({
    where: { id: r.categoriaId }, select: { slaDiasHabiles: true },
  })
  const reabiertoAt = new Date()
  // El plazo vuelve a correr desde hoy (decisión D-11): el compromiso original
  // ya se consumió, y medir contra él dejaría el reporte vencido de nacimiento.
  const fechaLimite = calcularFechaLimite(
    reabiertoAt, categoria.slaDiasHabiles, await cargarFestivos(),
  )

  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: r.id },
      data: {
        estatus: 'reabierto',
        reabiertoAt,
        fechaLimite,
        slaDiasHabilesAplicado: categoria.slaDiasHabiles,
        vecesReabierto: { increment: 1 },
        resueltoAt: null,
        cerradoAt: null,
      },
    })
    await registrarEvento(tx, {
      reporteId: r.id, tipo: 'reabierto',
      detalle: { origen: 'ciudadano', motivo: motivo.trim().slice(0, 500), nuevaFechaLimite: fechaLimite.toISOString() },
    })
  })

  await notificarCiudadano(r.id, 'reabierto')
  // Hay que volver: el área y quien lo tenía.
  await avisarArea(r.id, 'reabierto')
  const asignado = await prisma.reporte.findUnique({ where: { id: r.id }, select: { asignadoAId: true } })
  if (asignado?.asignadoAId) await avisarUsuario(r.id, asignado.asignadoAId, 'reabierto')
  return { folio: r.folio, fechaLimite }
}
