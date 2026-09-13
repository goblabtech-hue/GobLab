import { prisma } from '@/infrastructure/prisma'
import { ESTATUS_ABIERTOS, ESTATUS_VIVOS } from '@/domain/estatus'
import type { EstatusReporte } from '@/generated/prisma/enums'

/**
 * Informe por colonia: dónde se concentran los problemas.
 *
 * El tablero por dependencia dice quién trabaja; este dice dónde. Son
 * preguntas distintas: una colonia con muchos reportes abiertos de tres
 * áreas no aparece en ningún tablero de área, y es justo la que la
 * presidencia quiere ver antes de una gira o de un recorrido.
 *
 * Con `dependenciaId` se limita a lo de esa área (un titular ve sus colonias
 * calientes; dirección ve todas).
 */

export type PeriodoColonias = 30 | 90 | 365

export type FilaColonia = {
  id: number
  slug: string
  nombre: string
  codigoPostal: string | null
  tipo: string | null
  abiertos: number
  vencidos: number
  recibidos: number
  resueltos: number
  reabiertos: number
  /** El tipo de problema que más se repite en el periodo. */
  principal: { nombre: string; total: number } | null
  /** Áreas con reportes abiertos ahí, para que se vea si es un problema de una o de varias. */
  areas: { id: number; nombre: string; icono: string; color: string; abiertos: number }[]
}

export type InformeColonias = {
  periodoDias: PeriodoColonias
  desde: Date
  filas: FilaColonia[]
  totales: { colonias: number; conAbiertos: number; abiertos: number; vencidos: number; recibidos: number }
  sinColonia: { abiertos: number; recibidos: number }
}

export async function informeColonias(periodoDias: PeriodoColonias = 90, dependenciaId?: number | null): Promise<InformeColonias> {
  const ahora = new Date()
  const desde = new Date(ahora.getTime() - periodoDias * 86_400_000)
  const area = dependenciaId ? { dependenciaId } : {}

  const [colonias, reportes] = await Promise.all([
    prisma.colonia.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, slug: true, nombre: true, codigoPostal: true, tipo: true },
    }),
    // Abiertos (de cualquier fecha) + lo que entró en el periodo. Un abierto
    // de hace un año sigue siendo un problema de esa colonia hoy.
    prisma.reporte.findMany({
      where: {
        ...area,
        OR: [
          { estatus: { in: ESTATUS_ABIERTOS } },
          { createdAt: { gte: desde }, estatus: { in: ESTATUS_VIVOS.concat(['resuelto', 'cerrado'] as EstatusReporte[]) } },
        ],
      },
      select: {
        coloniaId: true, estatus: true, createdAt: true, resueltoAt: true, fechaLimite: true, vecesReabierto: true,
        categoria: { select: { nombre: true } },
        dependencia: { select: { id: true, nombre: true, icono: true, color: true } },
      },
    }),
  ])

  const porColonia = new Map<number, typeof reportes>()
  const sueltos: typeof reportes = []
  for (const r of reportes) {
    if (r.coloniaId === null) { sueltos.push(r); continue }
    const lista = porColonia.get(r.coloniaId) ?? []
    lista.push(r)
    porColonia.set(r.coloniaId, lista)
  }

  const esAbierto = (e: string) => (ESTATUS_ABIERTOS as string[]).includes(e)
  const enPeriodo = (r: { createdAt: Date; estatus: string }) => r.createdAt >= desde && r.estatus !== 'por_validar'

  const filas: FilaColonia[] = colonias.map((c) => {
    const suyos = porColonia.get(c.id) ?? []
    const abiertos = suyos.filter((r) => esAbierto(r.estatus))
    const recibidos = suyos.filter(enPeriodo)

    const porCategoria = new Map<string, number>()
    for (const r of recibidos) porCategoria.set(r.categoria.nombre, (porCategoria.get(r.categoria.nombre) ?? 0) + 1)
    const principal = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0]

    const porArea = new Map<number, FilaColonia['areas'][number]>()
    for (const r of abiertos) {
      const a = porArea.get(r.dependencia.id) ?? { ...r.dependencia, abiertos: 0 }
      a.abiertos++
      porArea.set(r.dependencia.id, a)
    }

    return {
      id: c.id, slug: c.slug, nombre: c.nombre, codigoPostal: c.codigoPostal, tipo: c.tipo,
      abiertos: abiertos.length,
      vencidos: abiertos.filter((r) => r.fechaLimite < ahora).length,
      recibidos: recibidos.length,
      resueltos: suyos.filter((r) => r.resueltoAt && r.resueltoAt >= desde).length,
      reabiertos: recibidos.filter((r) => r.vecesReabierto > 0).length,
      principal: principal ? { nombre: principal[0], total: principal[1] } : null,
      areas: [...porArea.values()].sort((a, b) => b.abiertos - a.abiertos),
    }
  })
    .filter((f) => f.abiertos > 0 || f.recibidos > 0)
    // Primero donde hay más abiertos; a igual carga, donde hay más vencidos;
    // después donde más ha llegado. Es el orden de «a dónde ir primero».
    .sort((a, b) => b.abiertos - a.abiertos || b.vencidos - a.vencidos || b.recibidos - a.recibidos)

  return {
    periodoDias, desde, filas,
    totales: {
      colonias: colonias.length,
      conAbiertos: filas.filter((f) => f.abiertos > 0).length,
      abiertos: filas.reduce((n, f) => n + f.abiertos, 0),
      vencidos: filas.reduce((n, f) => n + f.vencidos, 0),
      recibidos: filas.reduce((n, f) => n + f.recibidos, 0),
    },
    sinColonia: {
      abiertos: sueltos.filter((r) => esAbierto(r.estatus)).length,
      recibidos: sueltos.filter(enPeriodo).length,
    },
  }
}

/** Los reportes de una colonia, abiertos primero y los vencidos hasta arriba. */
export async function reportesDeColonia(coloniaId: number, dependenciaId?: number | null, periodoDias: PeriodoColonias = 90) {
  const ahora = new Date()
  const desde = new Date(ahora.getTime() - periodoDias * 86_400_000)
  const area = dependenciaId ? { dependenciaId } : {}
  const lista = await prisma.reporte.findMany({
    where: {
      coloniaId, ...area,
      estatus: { not: 'por_validar' },
      OR: [{ estatus: { in: ESTATUS_ABIERTOS } }, { createdAt: { gte: desde } }],
    },
    select: {
      id: true, folio: true, descripcion: true, estatus: true, prioridad: true, createdAt: true, fechaLimite: true,
      resueltoAt: true, cerradoAt: true, calificacion: true, vecesReabierto: true, direccionTexto: true,
      categoria: { select: { nombre: true, icono: true } },
      dependencia: { select: { id: true, nombre: true, icono: true, color: true } },
      asignadoA: { select: { nombre: true } },
      _count: { select: { adhesiones: true } },
    },
  })
  const peso = (r: (typeof lista)[number]) => {
    const abierto = (ESTATUS_ABIERTOS as string[]).includes(r.estatus)
    if (abierto && r.fechaLimite < ahora) return 0
    if (abierto) return 1
    if (r.estatus === 'resuelto') return 2
    return 3
  }
  return lista.sort((a, b) => peso(a) - peso(b) || a.fechaLimite.getTime() - b.fechaLimite.getTime())
}
