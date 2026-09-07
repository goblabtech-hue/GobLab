import { prisma } from '@/infrastructure/prisma'
import { ESTATUS_ABIERTOS } from '@/domain/estatus'
import { enCurso, type Semana } from '@/domain/semana'

/**
 * Informe semanal por dependencia (lo que se hizo y lo que queda).
 *
 * Es el documento de la junta del lunes: cada área ve cuánto resolvió, si
 * cumplió el plazo que el municipio prometió públicamente, y qué trae
 * atorado. El tablero ejecutivo responde «cómo vamos» en general; esto
 * responde «qué hizo cada quien esta semana», que es otra pregunta y necesita
 * otro corte.
 *
 * Una decisión que conviene entender antes de leer los números:
 *
 *   · **Lo que se hizo** es histórico y exacto: los reportes cuya resolución
 *     cayó dentro de la semana, comparados contra la fecha límite que se le
 *     prometió a cada uno.
 *   · **Lo que queda pendiente** es el estado de HOY, no el del domingo en que
 *     cerró la semana. Reconstruir el pendiente histórico exigiría rehacer el
 *     ir y venir de las reaperturas, y una cifra reconstruida a medias en un
 *     informe que se usa para evaluar a la gente es peor que no tenerla. Para
 *     la semana en curso —el uso normal— «hoy» y «el cierre» son lo mismo.
 */

const DIA = 86_400_000

export type PendienteViejo = {
  folio: string
  descripcion: string
  categoria: string
  diasAbierto: number
  /** Días transcurridos desde la fecha límite. 0 si todavía está en tiempo. */
  diasVencido: number
}

export type InformeDependencia = {
  id: number
  nombre: string
  responsable: string
  correo: string | null

  // Lo que se hizo en la semana
  resueltos: number
  aTiempo: number
  fueraDeTiempo: number
  /** Porcentaje 0–100, o null si no resolvió nada (no es 0%: es «sin datos»). */
  cumplimiento: number | null
  diasPromedio: number | null
  recibidos: number

  // La semana anterior, para saber si mejora o empeora
  resueltosPrevio: number
  cumplimientoPrevio: number | null

  // Lo que queda por resolver, al día de hoy
  pendientes: number
  pendientesVencidos: number
  masViejos: PendienteViejo[]
}

export type InformeSemanal = {
  semana: Semana
  /** La semana todavía corre: las cifras van a crecer. */
  enCurso: boolean
  generadoEn: Date
  dependencias: InformeDependencia[]
  totales: {
    resueltos: number
    aTiempo: number
    cumplimiento: number | null
    recibidos: number
    pendientes: number
    pendientesVencidos: number
  }
}

/** Cuántos de los que se resolvieron llegaron dentro del plazo prometido. */
type Resuelto = { dependenciaId: number; createdAt: Date; resueltoAt: Date | null; fechaLimite: Date }

function cumplimientoDe(rs: Resuelto[]): { aTiempo: number; pct: number | null } {
  if (rs.length === 0) return { aTiempo: 0, pct: null }
  const aTiempo = rs.filter((r) => r.resueltoAt !== null && r.resueltoAt <= r.fechaLimite).length
  return { aTiempo, pct: (aTiempo / rs.length) * 100 }
}

const promedioDias = (rs: Resuelto[]): number | null => {
  const ds = rs
    .filter((r) => r.resueltoAt !== null)
    .map((r) => (r.resueltoAt!.getTime() - r.createdAt.getTime()) / DIA)
  return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null
}

/** Cuántos pendientes viejos se listan por área antes de que deje de ayudar. */
const MAS_VIEJOS = 5

export async function informeSemanal(
  semana: Semana,
  soloDependenciaId?: number | null,
): Promise<InformeSemanal> {
  const ahora = new Date()
  const previaInicio = new Date(semana.inicio.getTime() - 7 * DIA)

  const dependencias = await prisma.dependencia.findMany({
    where: soloDependenciaId ? { id: soloDependenciaId } : { activa: true },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, responsable: true, correo: true },
  })
  if (dependencias.length === 0) {
    return {
      semana, enCurso: enCurso(semana, ahora), generadoEn: ahora, dependencias: [],
      totales: { resueltos: 0, aTiempo: 0, cumplimiento: null, recibidos: 0, pendientes: 0, pendientesVencidos: 0 },
    }
  }

  const ids = dependencias.map((d) => d.id)
  const campos = {
    dependenciaId: true, createdAt: true, resueltoAt: true, fechaLimite: true,
  } as const

  const [resueltos, previos, recibidos, abiertos] = await Promise.all([
    prisma.reporte.findMany({
      where: { dependenciaId: { in: ids }, resueltoAt: { gte: semana.inicio, lt: semana.fin } },
      select: campos,
    }),
    prisma.reporte.findMany({
      where: { dependenciaId: { in: ids }, resueltoAt: { gte: previaInicio, lt: semana.inicio } },
      select: campos,
    }),
    prisma.reporte.groupBy({
      by: ['dependenciaId'],
      where: { dependenciaId: { in: ids }, createdAt: { gte: semana.inicio, lt: semana.fin } },
      _count: { _all: true },
    }),
    prisma.reporte.findMany({
      where: { dependenciaId: { in: ids }, estatus: { in: ESTATUS_ABIERTOS } },
      // Del más viejo al más nuevo: los primeros de cada área son los que se
      // listan, y son los que hay que explicar en la junta.
      orderBy: { createdAt: 'asc' },
      select: {
        dependenciaId: true, folio: true, descripcion: true,
        createdAt: true, fechaLimite: true,
        categoria: { select: { nombre: true } },
      },
    }),
  ])

  const recibidosPorId = new Map(recibidos.map((r) => [r.dependenciaId, r._count._all]))

  const filas = dependencias.map((d): InformeDependencia => {
    const suyos = resueltos.filter((r) => r.dependenciaId === d.id)
    const suyosPrevios = previos.filter((r) => r.dependenciaId === d.id)
    const suyosAbiertos = abiertos.filter((r) => r.dependenciaId === d.id)

    const { aTiempo, pct } = cumplimientoDe(suyos)
    const previo = cumplimientoDe(suyosPrevios)

    return {
      id: d.id,
      nombre: d.nombre,
      responsable: d.responsable,
      correo: d.correo,

      resueltos: suyos.length,
      aTiempo,
      fueraDeTiempo: suyos.length - aTiempo,
      cumplimiento: pct,
      diasPromedio: promedioDias(suyos),
      recibidos: recibidosPorId.get(d.id) ?? 0,

      resueltosPrevio: suyosPrevios.length,
      cumplimientoPrevio: previo.pct,

      pendientes: suyosAbiertos.length,
      pendientesVencidos: suyosAbiertos.filter((r) => r.fechaLimite < ahora).length,
      masViejos: suyosAbiertos.slice(0, MAS_VIEJOS).map((r) => ({
        folio: r.folio,
        descripcion: r.descripcion,
        categoria: r.categoria.nombre,
        diasAbierto: Math.floor((ahora.getTime() - r.createdAt.getTime()) / DIA),
        diasVencido: Math.max(0, Math.floor((ahora.getTime() - r.fechaLimite.getTime()) / DIA)),
      })),
    }
  })

  const totalResueltos = filas.reduce((a, f) => a + f.resueltos, 0)
  const totalATiempo = filas.reduce((a, f) => a + f.aTiempo, 0)

  return {
    semana,
    enCurso: enCurso(semana, ahora),
    generadoEn: ahora,
    // El área con más vencidos primero: el informe se lee de arriba abajo y
    // arriba tiene que estar lo que urge, no la primera por orden alfabético.
    dependencias: filas.sort(
      (a, b) => b.pendientesVencidos - a.pendientesVencidos || b.pendientes - a.pendientes,
    ),
    totales: {
      resueltos: totalResueltos,
      aTiempo: totalATiempo,
      cumplimiento: totalResueltos ? (totalATiempo / totalResueltos) * 100 : null,
      recibidos: filas.reduce((a, f) => a + f.recibidos, 0),
      pendientes: filas.reduce((a, f) => a + f.pendientes, 0),
      pendientesVencidos: filas.reduce((a, f) => a + f.pendientesVencidos, 0),
    },
  }
}
