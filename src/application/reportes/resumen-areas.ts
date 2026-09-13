import { prisma } from '@/infrastructure/prisma'
import { ESTATUS_ABIERTOS } from '@/domain/estatus'

/**
 * Carga de trabajo por área, para la cabecera de la bandeja.
 *
 * Sin esto hay que filtrar área por área para saber quién va atrasado, o entrar
 * al tablero ejecutivo, que solo ve supervisión. Quien opera la bandeja todos
 * los días necesita ese panorama al abrirla.
 */

export type CargaArea = {
  id: number
  nombre: string
  abiertos: number
  vencidos: number
  sinCuadrilla: number
  /** Últimos 7 días: cuántos se registraron al área y cuántos resolvió. */
  llegaron7d: number
  resueltos7d: number
}

export async function cargaPorArea(soloDependenciaId?: number | null): Promise<CargaArea[]> {
  const ahora = new Date()
  const alcance = soloDependenciaId ? { id: soloDependenciaId } : { activa: true }

  const dependencias = await prisma.dependencia.findMany({
    where: alcance,
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true },
  })
  if (dependencias.length === 0) return []

  const ids = dependencias.map((d) => d.id)
  // Siete días corridos, no la semana calendario: la bandeja se abre a
  // diario y «desde el lunes» un martes no dice nada.
  const hace7 = new Date(ahora.getTime() - 7 * 24 * 3600_000)
  const [abiertos, llegaron, resueltos] = await Promise.all([
    prisma.reporte.findMany({
      where: { dependenciaId: { in: ids }, estatus: { in: ESTATUS_ABIERTOS } },
      select: { dependenciaId: true, estatus: true, fechaLimite: true },
    }),
    prisma.reporte.groupBy({
      by: ['dependenciaId'], _count: true,
      where: { dependenciaId: { in: ids }, createdAt: { gte: hace7 }, estatus: { not: 'por_validar' } },
    }),
    prisma.reporte.groupBy({
      by: ['dependenciaId'], _count: true,
      where: { dependenciaId: { in: ids }, resueltoAt: { gte: hace7 } },
    }),
  ])
  const conteo = (g: { dependenciaId: number; _count: number }[], id: number) => g.find((x) => x.dependenciaId === id)?._count ?? 0

  return dependencias
    .map((d) => {
      const suyos = abiertos.filter((r) => r.dependenciaId === d.id)
      return {
        id: d.id,
        nombre: d.nombre,
        abiertos: suyos.length,
        vencidos: suyos.filter((r) => r.fechaLimite < ahora).length,
        // "nuevo" significa que tiene área pero todavía no tiene a nadie atrás.
        sinCuadrilla: suyos.filter((r) => r.estatus === 'nuevo').length,
        llegaron7d: conteo(llegaron, d.id),
        resueltos7d: conteo(resueltos, d.id),
      }
    })
    .sort((a, b) => b.vencidos - a.vencidos || b.abiertos - a.abiertos)
}
