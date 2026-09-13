import { prisma } from '@/infrastructure/prisma'
import { ESTATUS_ABIERTOS } from '@/domain/estatus'
import { semanaDe } from '@/domain/semana'
import { obtenerIndicadores, type Indicadores } from './indicadores'
import { calcularIndicadoresInternos, type FilaCuadrilla } from './indicadores-internos'
import { informeSemanal, type InformeDependencia } from './reportes/informe-semanal'

/**
 * El tablero de una dependencia: lo que ve su titular al entrar.
 *
 * Junta en una pantalla lo que antes estaba repartido: la bandeja (qué tengo),
 * los indicadores (cómo voy) y el informe semanal (qué hice). Todo con las
 * mismas definiciones que el tablero público y el de dirección, para que
 * cuando la dirección pregunte por un número, el área esté viendo el mismo.
 */

export type ReporteBreve = {
  id: string; folio: string; descripcion: string; estatus: string
  categoria: string; colonia: string | null
  fechaLimite: Date; vencido: boolean; asignadoA: string | null
  createdAt: Date
}

export type ResueltoBreve = {
  id: string; folio: string; categoria: string; colonia: string | null
  resueltoAt: Date; aTiempo: boolean; calificacion: number | null; porQuien: string | null
}

export type PanelDependencia = {
  dependencia: { id: number; nombre: string; responsable: string | null; correo: string | null }
  carga: { abiertos: number; vencidos: number; sinCuadrilla: number; porVencerHoy: number }
  indicadores: Indicadores
  cuadrillas: FilaCuadrilla[]
  semana: InformeDependencia | null
  pendientes: ReporteBreve[]
  resueltos: ResueltoBreve[]
}

export async function panelDependencia(dependenciaId: number): Promise<PanelDependencia | null> {
  const dependencia = await prisma.dependencia.findUnique({
    where: { id: dependenciaId },
    select: { id: true, nombre: true, responsable: true, correo: true },
  })
  if (!dependencia) return null

  const ahora = new Date()
  const finDeHoy = new Date(ahora); finDeHoy.setHours(23, 59, 59, 999)
  const abiertosWhere = { dependenciaId, estatus: { in: ESTATUS_ABIERTOS } }

  const [indicadores, internos, informe, abiertos, resueltos] = await Promise.all([
    obtenerIndicadores(dependenciaId),
    calcularIndicadoresInternos(),
    informeSemanal(semanaDe(ahora), dependenciaId),
    prisma.reporte.findMany({
      where: abiertosWhere,
      orderBy: { fechaLimite: 'asc' },
      select: {
        id: true, folio: true, descripcion: true, estatus: true, fechaLimite: true, createdAt: true, asignadoAId: true,
        categoria: { select: { nombre: true } }, colonia: { select: { nombre: true } },
        asignadoA: { select: { nombre: true } },
      },
    }),
    prisma.reporte.findMany({
      where: { dependenciaId, resueltoAt: { not: null } },
      orderBy: { resueltoAt: 'desc' }, take: 8,
      select: {
        id: true, folio: true, resueltoAt: true, fechaLimite: true, calificacion: true,
        categoria: { select: { nombre: true } }, colonia: { select: { nombre: true } },
        asignadoA: { select: { nombre: true } },
      },
    }),
  ])

  const cuadrillaIds = new Set(
    (await prisma.usuario.findMany({ where: { rol: 'cuadrilla', dependenciaId, activo: true }, select: { id: true } })).map((u) => u.id),
  )

  return {
    dependencia,
    carga: {
      abiertos: abiertos.length,
      vencidos: abiertos.filter((r) => r.fechaLimite < ahora).length,
      sinCuadrilla: abiertos.filter((r) => !r.asignadoAId).length,
      porVencerHoy: abiertos.filter((r) => r.fechaLimite >= ahora && r.fechaLimite <= finDeHoy).length,
    },
    indicadores,
    cuadrillas: internos.cuadrillas.filter((c) => cuadrillaIds.has(c.id)),
    semana: informe.dependencias.find((f) => f.id === dependenciaId) ?? null,
    pendientes: abiertos.slice(0, 12).map((r) => ({
      id: r.id, folio: r.folio, descripcion: r.descripcion, estatus: r.estatus,
      categoria: r.categoria.nombre, colonia: r.colonia?.nombre ?? null,
      fechaLimite: r.fechaLimite, vencido: r.fechaLimite < ahora,
      asignadoA: r.asignadoA?.nombre ?? null, createdAt: r.createdAt,
    })),
    resueltos: resueltos.map((r) => ({
      id: r.id, folio: r.folio, categoria: r.categoria.nombre, colonia: r.colonia?.nombre ?? null,
      resueltoAt: r.resueltoAt!, aTiempo: r.resueltoAt! <= r.fechaLimite,
      calificacion: r.calificacion, porQuien: r.asignadoA?.nombre ?? null,
    })),
  }
}
