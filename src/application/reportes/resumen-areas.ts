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
  const abiertos = await prisma.reporte.findMany({
    where: { dependenciaId: { in: ids }, estatus: { in: ESTATUS_ABIERTOS } },
    select: { dependenciaId: true, estatus: true, fechaLimite: true },
  })

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
      }
    })
    .sort((a, b) => b.vencidos - a.vencidos || b.abiertos - a.abiertos)
}
