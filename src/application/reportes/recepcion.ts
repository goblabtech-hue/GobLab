import { prisma } from '@/infrastructure/prisma'
import { puedeTransicionar } from '@/domain/estatus'
import { ReglaDeNegocio, registrarEvento } from './nucleo'
import { notificarCiudadano } from '@/application/notificaciones'
import { avisarArea } from '@/application/avisos-personal'

/**
 * Recepción: una persona decide si un reporte se registra o no.
 *
 * Todo lo que llega de la gente —por WhatsApp, Telegram, la web o la app—
 * entra «por validar». Nadie más lo ve: ni el área, ni el mapa, ni la página
 * pública del folio. Una persona del municipio lo lee, ve las fotos, y
 * decide. No hay filtro automático ni inteligencia artificial en esta
 * decisión: es de una persona, y queda registrada con su nombre.
 *
 * Al aceptar puede además decidir que el texto y las fotos NO se muestren al
 * público, si el problema es real pero lo escrito no es publicable. El área
 * lo ve completo de todas formas: tiene que atenderlo.
 */

export type DatosAceptacion = {
  reporteId: string
  userId: string
  /** El problema es real pero el texto o las fotos no son publicables. */
  ocultarContenido?: boolean
  /** Corregir la categoría si recepción ve que no era esa. */
  categoriaId?: number
}

export async function aceptarReporte(datos: DatosAceptacion) {
  const { reporteId, userId, ocultarContenido = false } = datos
  const r = await prisma.reporte.findUnique({
    where: { id: reporteId },
    select: { estatus: true, categoriaId: true, dependenciaId: true },
  })
  if (!r) throw new ReglaDeNegocio('No encontramos ese reporte.')
  if (!puedeTransicionar(r.estatus, 'nuevo')) {
    throw new ReglaDeNegocio('Este reporte ya fue validado.')
  }

  let categoriaId = r.categoriaId
  let dependenciaId = r.dependenciaId
  if (datos.categoriaId && datos.categoriaId !== r.categoriaId) {
    const cat = await prisma.categoria.findUnique({
      where: { id: datos.categoriaId }, select: { id: true, dependenciaId: true, activa: true },
    })
    if (!cat || !cat.activa) throw new ReglaDeNegocio('Esa categoría no está disponible.')
    categoriaId = cat.id
    dependenciaId = cat.dependenciaId
  }

  const ahora = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: reporteId },
      data: {
        estatus: 'nuevo',
        categoriaId, dependenciaId,
        moderacion: ocultarContenido ? 'oculto' : 'aprobado',
        moderadoAt: ahora, moderadoPorId: userId,
        motivoModeracion: ocultarContenido ? 'Recepción decidió no mostrar el contenido al público.' : null,
      },
    })
    await registrarEvento(tx, {
      reporteId, tipo: 'comentario', userId,
      detalle: {
        recepcion: 'aceptado',
        contenidoPublico: !ocultarContenido,
        ...(categoriaId !== r.categoriaId ? { categoriaCorregidaA: categoriaId } : {}),
      },
    })
  })

  // Ahora sí es del área.
  await avisarArea(reporteId, 'nuevo_en_area')
}

export async function rechazarReporte(reporteId: string, userId: string, motivo: string) {
  const limpio = motivo.trim()
  if (limpio.length < 5) throw new ReglaDeNegocio('Escribe por qué no se registra: el ciudadano lo va a leer.')

  const r = await prisma.reporte.findUnique({ where: { id: reporteId }, select: { estatus: true } })
  if (!r) throw new ReglaDeNegocio('No encontramos ese reporte.')
  // Solo lo que espera en recepción: un reporte ya registrado se declara
  // improcedente desde la bandeja, con su propio flujo.
  if (r.estatus !== 'por_validar') {
    throw new ReglaDeNegocio('Este reporte ya fue validado.')
  }

  const ahora = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: reporteId },
      data: {
        estatus: 'improcedente', motivoImprocedente: limpio, cerradoAt: ahora,
        // Lo rechazado nunca es público.
        moderacion: 'oculto', moderadoAt: ahora, moderadoPorId: userId,
        motivoModeracion: 'Rechazado en recepción.',
      },
    })
    await registrarEvento(tx, { reporteId, tipo: 'improcedente', userId, detalle: { recepcion: 'rechazado', motivo: limpio } })
  })

  await notificarCiudadano(reporteId, 'improcedente')
}

/** Cambiar después si algo aprobado resultó no publicable, o al revés. */
export async function cambiarVisibilidad(reporteId: string, userId: string, publico: boolean, motivo?: string) {
  const r = await prisma.reporte.findUnique({ where: { id: reporteId }, select: { estatus: true } })
  if (!r) throw new ReglaDeNegocio('No encontramos ese reporte.')
  if (r.estatus === 'por_validar') throw new ReglaDeNegocio('Primero hay que validarlo.')
  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: reporteId },
      data: {
        moderacion: publico ? 'aprobado' : 'oculto',
        moderadoAt: new Date(), moderadoPorId: userId,
        motivoModeracion: publico ? null : (motivo?.trim() || 'Ocultado por moderación.'),
      },
    })
    await registrarEvento(tx, { reporteId, tipo: 'comentario', userId, detalle: { moderacion: publico ? 'publico' : 'oculto', motivo: motivo ?? null } })
  })
}

/** La cola de recepción: lo que espera a una persona, lo más viejo primero. */
export async function porValidar() {
  return prisma.reporte.findMany({
    where: { estatus: 'por_validar' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, folio: true, descripcion: true, direccionTexto: true, origen: true, createdAt: true,
      lat: true, lng: true, prioridad: true,
      categoria: { select: { id: true, nombre: true } },
      colonia: { select: { nombre: true } },
      fotos: { where: { tipo: 'ciudadano' }, select: { id: true, url: true } },
    },
  })
}
