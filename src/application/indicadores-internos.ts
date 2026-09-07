import { prisma } from '@/infrastructure/prisma'
import { diasHabilesEntre } from '@/domain/dias-habiles'
import { cargarFestivos } from '@/infrastructure/festivos'
import { ESTATUS_ABIERTOS } from '@/domain/estatus'
import type { EstatusReporte } from '@/generated/prisma/enums'

/**
 * Métricas del tablero ejecutivo (SPEC §4.5).
 *
 * Es todo lo del tablero público más el desglose que no se publica: quién
 * resuelve qué, cuánto tarda cada dependencia en dar la primera respuesta y
 * cómo se comporta el bot.
 *
 * Estas cifras miden el desempeño de personas con nombre y apellido. Se
 * calculan sobre lo que ya está en la bitácora, sin métricas inventadas, y la
 * sección lleva una advertencia visible: un ranking sin contexto es una
 * herramienta para castigar, no para mejorar.
 */

export type FilaDependencia = {
  id: number
  nombre: string
  abiertos: number
  vencidos: number
  resueltos: number
  aTiempo: number
  cumplimiento: number | null
  diasPromedio: number | null
  primeraRespuestaHoras: number | null
  reasignadosRecibidos: number
}

export type FilaCuadrilla = {
  id: string
  nombre: string
  dependencia: string | null
  asignadosAbiertos: number
  resueltos: number
  aTiempo: number
  cumplimiento: number | null
  diasPromedio: number | null
  reabiertos: number
  calificacionPromedio: number | null
}

export type EmbudoBot = {
  conversaciones: number
  conReporte: number
  escaladas: number
  efectividad: number
  tasaEscalamiento: number
  clasificacionesIA: number
  usoFallback: number
  emergenciasDetectadas: number
}

export type IndicadoresInternos = {
  desde: string
  dependencias: FilaDependencia[]
  cuadrillas: FilaCuadrilla[]
  bot: EmbudoBot
  reaperturasPorCategoria: { categoria: string; total: number }[]
  primeraRespuestaGlobalHoras: number | null
}


const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

type ReporteInterno = {
  dependenciaId: number
  asignadoAId: string | null
  estatus: EstatusReporte
  createdAt: Date
  resueltoAt: Date | null
  fechaLimite: Date
  calificacion: number | null
  vecesReabierto: number
}

function armarDependencias(
  datos: {
    dependencias: { id: number; nombre: string }[]
    reportes: ReporteInterno[]
    primerasRespuestas: { dependenciaId: number; horas: number }[]
    reasignados: { detalle: unknown }[]
  },
  festivos: ReadonlySet<string>,
  ahora: Date,
): FilaDependencia[] {
  const horas = new Map<number, number[]>()
  for (const p of datos.primerasRespuestas) {
    const lista = horas.get(p.dependenciaId) ?? []
    lista.push(Number(p.horas))
    horas.set(p.dependenciaId, lista)
  }

  // Quién RECIBE reasignaciones: si un área recibe muchas, el problema está en
  // cómo se clasifica al entrar, no en ella.
  const recibidos = new Map<number, number>()
  for (const ev of datos.reasignados) {
    const destino = (ev.detalle as { a?: number } | null)?.a
    if (typeof destino === 'number') recibidos.set(destino, (recibidos.get(destino) ?? 0) + 1)
  }

  return datos.dependencias.map((d) => {
    const suyos = datos.reportes.filter((r) => r.dependenciaId === d.id)
    const resueltos = suyos.filter((r) => r.resueltoAt !== null)
    const aTiempo = resueltos.filter((r) => r.resueltoAt! <= r.fechaLimite).length
    return {
      id: d.id,
      nombre: d.nombre,
      abiertos: suyos.filter((r) => ESTATUS_ABIERTOS.includes(r.estatus)).length,
      vencidos: suyos.filter((r) => ESTATUS_ABIERTOS.includes(r.estatus) && r.fechaLimite < ahora).length,
      resueltos: resueltos.length,
      aTiempo,
      cumplimiento: resueltos.length ? (aTiempo / resueltos.length) * 100 : null,
      diasPromedio: promedio(resueltos.map((r) => diasHabilesEntre(r.createdAt, r.resueltoAt!, festivos))),
      primeraRespuestaHoras: promedio(horas.get(d.id) ?? []),
      reasignadosRecibidos: recibidos.get(d.id) ?? 0,
    }
  })
}

function armarCuadrillas(
  datos: {
    cuadrillas: { id: string; nombre: string; dependencia: { nombre: string } | null }[]
    reportes: ReporteInterno[]
  },
  festivos: ReadonlySet<string>,
): FilaCuadrilla[] {
  return datos.cuadrillas.map((c) => {
    const suyos = datos.reportes.filter((r) => r.asignadoAId === c.id)
    const resueltos = suyos.filter((r) => r.resueltoAt !== null)
    const aTiempo = resueltos.filter((r) => r.resueltoAt! <= r.fechaLimite).length
    const califs = resueltos.map((r) => r.calificacion).filter((n): n is number => n !== null)
    return {
      id: c.id,
      nombre: c.nombre,
      dependencia: c.dependencia?.nombre ?? null,
      asignadosAbiertos: suyos.filter((r) => ESTATUS_ABIERTOS.includes(r.estatus)).length,
      resueltos: resueltos.length,
      aTiempo,
      cumplimiento: resueltos.length ? (aTiempo / resueltos.length) * 100 : null,
      diasPromedio: promedio(resueltos.map((r) => diasHabilesEntre(r.createdAt, r.resueltoAt!, festivos))),
      reabiertos: suyos.filter((r) => r.vecesReabierto > 0).length,
      calificacionPromedio: promedio(califs),
    }
  })
}

function armarEmbudo(
  conversaciones: { reporteId: string | null; escaladaAHumano: boolean }[],
  clasificaciones: { usoFallback: boolean; esEmergencia: boolean }[],
): EmbudoBot {
  const total = conversaciones.length
  const conReporte = conversaciones.filter((c) => c.reporteId !== null).length
  const escaladas = conversaciones.filter((c) => c.escaladaAHumano).length
  return {
    conversaciones: total,
    conReporte,
    escaladas,
    efectividad: total ? (conReporte / total) * 100 : 0,
    tasaEscalamiento: total ? (escaladas / total) * 100 : 0,
    clasificacionesIA: clasificaciones.length,
    usoFallback: clasificaciones.filter((c) => c.usoFallback).length,
    emergenciasDetectadas: clasificaciones.filter((c) => c.esEmergencia).length,
  }
}

export async function calcularIndicadoresInternos(meses = 12): Promise<IndicadoresInternos> {
  const desde = new Date()
  desde.setMonth(desde.getMonth() - meses)
  const ahora = new Date()

  const [festivos, dependencias, cuadrillas, reportes, primerasRespuestas, conversaciones, clasificaciones, reaperturas] =
    await Promise.all([
      cargarFestivos(),
      prisma.dependencia.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
      prisma.usuario.findMany({
        where: { rol: 'cuadrilla' }, orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true, dependencia: { select: { nombre: true } } },
      }),
      prisma.reporte.findMany({
        where: { createdAt: { gte: desde } },
        select: {
          id: true, dependenciaId: true, asignadoAId: true, estatus: true,
          createdAt: true, resueltoAt: true, fechaLimite: true,
          calificacion: true, vecesReabierto: true,
        },
      }),
      // Primera respuesta: el primer evento que no es la creación.
      prisma.$queryRaw<{ reporteId: string; dependenciaId: number; horas: number }[]>`
        SELECT r.id AS "reporteId",
               r."dependenciaId" AS "dependenciaId",
               EXTRACT(EPOCH FROM (MIN(e.timestamp) - r."createdAt")) / 3600 AS horas
          FROM "Reporte" r
          JOIN "EventoReporte" e ON e."reporteId" = r.id
         WHERE r."createdAt" >= ${desde}
           AND e.tipo <> 'creado'
         GROUP BY r.id, r."dependenciaId", r."createdAt"
      `,
      prisma.conversacionBot.findMany({
        where: { createdAt: { gte: desde } },
        select: { reporteId: true, escaladaAHumano: true },
      }),
      prisma.clasificacionIA.findMany({
        where: { createdAt: { gte: desde } },
        select: { usoFallback: true, esEmergencia: true },
      }),
      prisma.reporte.groupBy({
        by: ['categoriaId'], _count: true,
        where: { reabiertoAt: { gte: desde } },
        orderBy: { _count: { categoriaId: 'desc' } },
      }),
    ])

  const reasignados = await prisma.eventoReporte.findMany({
    where: { tipo: 'reasignado', timestamp: { gte: desde } },
    select: { detalle: true },
  })

  const filasDependencia = armarDependencias(
    { dependencias, reportes, primerasRespuestas, reasignados }, festivos, ahora,
  )
  const filasCuadrilla = armarCuadrillas({ cuadrillas, reportes }, festivos)
  const bot = armarEmbudo(conversaciones, clasificaciones)

  // ---------------------------------------------------------------- reaperturas
  const categorias = await prisma.categoria.findMany({
    where: { id: { in: reaperturas.map((r) => r.categoriaId) } },
    select: { id: true, nombre: true },
  })
  const nombreCat = new Map(categorias.map((c) => [c.id, c.nombre]))

  return {
    desde: desde.toISOString(),
    dependencias: filasDependencia,
    cuadrillas: filasCuadrilla,
    bot,
    reaperturasPorCategoria: reaperturas.map((r) => ({
      categoria: nombreCat.get(r.categoriaId) ?? '—',
      total: r._count,
    })),
    primeraRespuestaGlobalHoras: promedio(primerasRespuestas.map((p) => Number(p.horas))),
  }
}

export const HORAS_A_TEXTO = (h: number | null): string => {
  if (h === null) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${h.toFixed(1)} h`
  return `${(h / 24).toFixed(1)} días`
}

