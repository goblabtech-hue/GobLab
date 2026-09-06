import { prisma } from '@/lib/prisma'
import { generarFolio } from '@/lib/folio'
import { calcularFechaLimite, cargarFestivos } from '@/lib/sla'
import { derivarTelefono, hashTelefono } from '@/lib/telefono'
import { buscarDuplicados, prioridadPorAdhesiones } from '@/lib/duplicados'
import { CALIFICACION_REAPERTURA, DIAS_AUTOCIERRE, MAX_REAPERTURAS } from '@/lib/config'
import type { Prisma } from '@/generated/prisma/client'
import type { EstatusReporte, OrigenReporte, Prioridad, TipoEvento } from '@/generated/prisma/enums'

/**
 * Ciclo de vida del reporte (SPEC §4.2 y §4.3).
 *
 * Toda transición pasa por aquí y deja un evento en la línea de tiempo. Las
 * pantallas no tocan `estatus` directamente: si lo hicieran, el historial —que
 * es de donde salen los KPIs de reasignación y reapertura— quedaría incompleto.
 */

export class ReglaDeNegocio extends Error {}

// ---------------------------------------------------------------- transiciones

/** Qué estatus puede seguir a cuál. Lo que no está aquí, no se permite. */
export const TRANSICIONES: Record<EstatusReporte, EstatusReporte[]> = {
  nuevo:        ['asignado', 'en_atencion', 'duplicado', 'improcedente'],
  asignado:     ['en_atencion', 'resuelto', 'duplicado', 'improcedente'],
  en_atencion:  ['resuelto', 'asignado', 'duplicado', 'improcedente'],
  resuelto:     ['cerrado', 'reabierto'],
  cerrado:      ['reabierto'],
  reabierto:    ['en_atencion', 'resuelto', 'asignado'],
  duplicado:    [],
  improcedente: [],
}

export function puedeTransicionar(desde: EstatusReporte, hacia: EstatusReporte) {
  return TRANSICIONES[desde].includes(hacia)
}

async function registrarEvento(
  tx: Prisma.TransactionClient,
  reporteId: string,
  tipo: TipoEvento,
  detalle: Prisma.InputJsonValue = {},
  userId?: string | null,
) {
  await tx.eventoReporte.create({
    data: { reporteId, tipo, detalle, userId: userId ?? null },
  })
}

// ---------------------------------------------------------------- alta

export type DatosNuevoReporte = {
  categoriaId: number
  descripcion: string
  origen: OrigenReporte
  lat?: number | null
  lng?: number | null
  direccionTexto?: string | null
  coloniaId?: number | null
  telefono?: string | null
  nombreContacto?: string | null
  prioridad?: Prioridad
  fotos?: string[]
  /** Id del operador que captura, cuando el origen es teléfono o ventanilla. */
  capturadoPorId?: string | null
}

export type ReporteCreado = {
  id: string
  folio: string
  fechaLimite: Date
  slaDiasHabiles: number
  categoriaNombre: string
}

/**
 * Crea un reporte con folio, fecha límite y dependencia responsable.
 *
 * DECISIÓN D-09: el reporte nace en `nuevo` con la dependencia ya definida por
 * la categoría (SPEC §4.2: "el reporte nace asignado"); pasa a `asignado`
 * cuando se le asigna una cuadrilla concreta. Así `nuevo` significa algo
 * accionable en la bandeja —"falta ponerle cuadrilla"— en vez de ser un estado
 * que nadie usa.
 */
export async function crearReporte(datos: DatosNuevoReporte): Promise<ReporteCreado> {
  const categoria = await prisma.categoria.findUnique({
    where: { id: datos.categoriaId },
    select: { id: true, nombre: true, slaDiasHabiles: true, dependenciaId: true, activa: true },
  })
  if (!categoria) throw new ReglaDeNegocio('Esa categoría no existe.')
  if (!categoria.activa) throw new ReglaDeNegocio('Esa categoría ya no está disponible.')

  const festivos = await cargarFestivos()
  const creado = new Date()
  const fechaLimite = calcularFechaLimite(creado, categoria.slaDiasHabiles, festivos)
  const tel = datos.telefono ? derivarTelefono(datos.telefono) : null

  const reporte = await prisma.$transaction(async (tx) => {
    const folio = await generarFolio(tx, creado)

    const r = await tx.reporte.create({
      data: {
        folio,
        categoriaId: categoria.id,
        descripcion: datos.descripcion.trim(),
        origen: datos.origen,
        prioridad: datos.prioridad ?? 'normal',
        estatus: 'nuevo',
        lat: datos.lat ?? null,
        lng: datos.lng ?? null,
        direccionTexto: datos.direccionTexto?.trim() || null,
        coloniaId: datos.coloniaId ?? null,
        telefonoHash: tel?.telefonoHash ?? null,
        telefonoCifrado: tel?.telefonoCifrado ?? null,
        telefonoMascara: tel?.telefonoMascara ?? null,
        nombreContacto: datos.nombreContacto?.trim() || null,
        dependenciaId: categoria.dependenciaId,
        fechaLimite,
        createdAt: creado,
      },
      select: { id: true, folio: true, fechaLimite: true },
    })

    if (datos.fotos?.length) {
      await tx.fotoReporte.createMany({
        data: datos.fotos.map((url) => ({ reporteId: r.id, url, tipo: 'ciudadano' as const })),
      })
    }

    await registrarEvento(tx, r.id, 'creado', {
      origen: datos.origen,
      dependenciaId: categoria.dependenciaId,
      fotos: datos.fotos?.length ?? 0,
    }, datos.capturadoPorId)

    return r
  })

  return {
    ...reporte,
    slaDiasHabiles: categoria.slaDiasHabiles,
    categoriaNombre: categoria.nombre,
  }
}

// ---------------------------------------------------------------- duplicados

/** Candidatos a duplicado para un reporte que aún no se crea (SPEC §4.2). */
export async function posiblesDuplicados(categoriaId: number, lat?: number | null, lng?: number | null) {
  return buscarDuplicados({ categoriaId, lat: lat ?? null, lng: lng ?? null })
}

/**
 * Suma un teléfono a las notificaciones de un reporte existente en vez de
 * abrir uno nuevo. Las adhesiones suben la prioridad (SPEC §4.2).
 */
export async function adherirse(reporteId: string, telefono: string) {
  const tel = derivarTelefono(telefono)

  const reporte = await prisma.reporte.findUnique({
    where: { id: reporteId },
    select: { id: true, folio: true, estatus: true, prioridad: true, telefonoHash: true },
  })
  if (!reporte) throw new ReglaDeNegocio('Ese reporte no existe.')
  if (!['nuevo', 'asignado', 'en_atencion', 'reabierto'].includes(reporte.estatus)) {
    throw new ReglaDeNegocio('Ese reporte ya está cerrado; conviene levantar uno nuevo.')
  }
  if (reporte.telefonoHash === tel.telefonoHash) {
    throw new ReglaDeNegocio('Este reporte ya es tuyo: puedes seguirlo con su folio.')
  }

  await prisma.adhesion.upsert({
    where: { reporteId_telefonoHash: { reporteId, telefonoHash: tel.telefonoHash } },
    create: { reporteId, ...tel },
    update: {},
  })

  const total = await prisma.adhesion.count({ where: { reporteId } })
  const nueva = prioridadPorAdhesiones(total)

  await prisma.$transaction(async (tx) => {
    if (nueva !== reporte.prioridad) {
      await tx.reporte.update({ where: { id: reporteId }, data: { prioridad: nueva } })
    }
    await registrarEvento(tx, reporteId, 'adhesion', { adhesiones: total, prioridad: nueva })
  })

  return { folio: reporte.folio, adhesiones: total, prioridad: nueva }
}

/** Marca un reporte como duplicado de otro y liga al ciudadano al original. */
export async function marcarDuplicado(reporteId: string, originalId: string, userId: string) {
  if (reporteId === originalId) throw new ReglaDeNegocio('Un reporte no puede ser duplicado de sí mismo.')

  const [r, original] = await Promise.all([
    prisma.reporte.findUnique({ where: { id: reporteId }, select: { estatus: true, telefonoCifrado: true } }),
    prisma.reporte.findUnique({ where: { id: originalId }, select: { id: true, folio: true } }),
  ])
  if (!r || !original) throw new ReglaDeNegocio('Reporte no encontrado.')
  if (!puedeTransicionar(r.estatus, 'duplicado')) {
    throw new ReglaDeNegocio('Ese reporte ya no se puede marcar como duplicado.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: reporteId },
      data: { estatus: 'duplicado', reporteOriginalId: originalId },
    })
    await registrarEvento(tx, reporteId, 'duplicado', { originalId, folioOriginal: original.folio }, userId)
  })
}

// ---------------------------------------------------------------- triaje

export async function asignarCuadrilla(reporteId: string, cuadrillaId: string, userId: string) {
  const r = await prisma.reporte.findUnique({
    where: { id: reporteId }, select: { estatus: true, asignadoAId: true },
  })
  if (!r) throw new ReglaDeNegocio('Reporte no encontrado.')
  if (r.estatus !== 'nuevo' && !puedeTransicionar(r.estatus, 'asignado')) {
    throw new ReglaDeNegocio('Ese reporte ya no admite asignación.')
  }

  const cuadrilla = await prisma.usuario.findUnique({
    where: { id: cuadrillaId }, select: { id: true, nombre: true, activo: true },
  })
  if (!cuadrilla?.activo) throw new ReglaDeNegocio('Esa cuenta no está activa.')

  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: reporteId },
      data: { asignadoAId: cuadrillaId, estatus: r.estatus === 'nuevo' ? 'asignado' : r.estatus },
    })
    await registrarEvento(tx, reporteId, 'asignado', { cuadrillaId, cuadrilla: cuadrilla.nombre }, userId)
  })
}

/**
 * Reasigna a otra dependencia. El motivo es obligatorio porque cada
 * reasignación alimenta el KPI de mal ruteo (SPEC §4.2 y §6.5): sin motivo, el
 * indicador dice que algo se rutea mal pero no por qué.
 */
export async function reasignarDependencia(
  reporteId: string, dependenciaId: number, motivo: string, userId: string,
) {
  const limpio = motivo.trim()
  if (limpio.length < 10) {
    throw new ReglaDeNegocio('Explica en al menos 10 caracteres por qué se reasigna.')
  }

  const r = await prisma.reporte.findUnique({
    where: { id: reporteId }, select: { estatus: true, dependenciaId: true },
  })
  if (!r) throw new ReglaDeNegocio('Reporte no encontrado.')
  if (['cerrado', 'duplicado', 'improcedente'].includes(r.estatus)) {
    throw new ReglaDeNegocio('Un reporte cerrado ya no se reasigna.')
  }
  if (r.dependenciaId === dependenciaId) {
    throw new ReglaDeNegocio('El reporte ya está en esa dependencia.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: reporteId },
      // cambiar de dependencia invalida la cuadrilla anterior
      data: { dependenciaId, asignadoAId: null },
    })
    await registrarEvento(tx, reporteId, 'reasignado', {
      de: r.dependenciaId, a: dependenciaId, motivo: limpio,
    }, userId)
  })
}

export async function marcarImprocedente(reporteId: string, motivo: string, userId: string) {
  const limpio = motivo.trim()
  if (limpio.length < 15) {
    throw new ReglaDeNegocio('El motivo se le muestra al ciudadano: explícalo en al menos 15 caracteres.')
  }
  const r = await prisma.reporte.findUnique({ where: { id: reporteId }, select: { estatus: true } })
  if (!r) throw new ReglaDeNegocio('Reporte no encontrado.')
  if (!puedeTransicionar(r.estatus, 'improcedente')) {
    throw new ReglaDeNegocio('Ese reporte ya no se puede marcar como improcedente.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: reporteId },
      data: { estatus: 'improcedente', motivoImprocedente: limpio },
    })
    await registrarEvento(tx, reporteId, 'improcedente', { motivo: limpio }, userId)
  })
}

export async function iniciarAtencion(reporteId: string, userId: string) {
  const r = await prisma.reporte.findUnique({ where: { id: reporteId }, select: { estatus: true } })
  if (!r) throw new ReglaDeNegocio('Reporte no encontrado.')
  if (r.estatus === 'en_atencion') return
  if (!puedeTransicionar(r.estatus, 'en_atencion')) {
    throw new ReglaDeNegocio('Ese reporte no se puede poner en atención.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({ where: { id: reporteId }, data: { estatus: 'en_atencion' } })
    await registrarEvento(tx, reporteId, 'en_atencion', {}, userId)
  })
}

// ---------------------------------------------------------------- resolución

/**
 * Cierra el trabajo de campo. Exige al menos una foto de evidencia salvo que
 * la categoría esté marcada con `requiereEvidencia = false` (SPEC §5).
 */
export async function resolverReporte(
  reporteId: string, userId: string, fotosEvidencia: string[], notaCierre?: string,
) {
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
    await registrarEvento(tx, reporteId, 'resuelto', { evidencias: evidenciaTotal }, userId)
    await registrarEvento(tx, reporteId, 'notificacion', { tipo: 'resuelto', pideCalificacion: true })
  })

  return { folio: r.folio, resueltoAt }
}

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
    await registrarEvento(tx, r.id, 'calificado', { calificacion })
    await registrarEvento(tx, r.id, 'cerrado', { automatico: false })
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
        vecesReabierto: { increment: 1 },
      },
    })
    await registrarEvento(tx, r.id, 'reabierto', {
      motivo: motivo?.trim() || null,
      nuevaFechaLimite: nuevaFechaLimite.toISOString(),
    })
  })
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
      await registrarEvento(tx, id, 'cerrado', { automatico: true, diasSinRespuesta: DIAS_AUTOCIERRE })
    })
  }

  return pendientes.length
}
