import { prisma } from '@/infrastructure/prisma'
import { diasHabilesEntre, TZ } from '@/domain/dias-habiles'
import { cargarFestivos } from '@/infrastructure/festivos'
import { ESTATUS_ABIERTOS } from '@/domain/presentacion'
import type { EstatusReporte, OrigenReporte } from '@/generated/prisma/enums'

/**
 * Indicadores del tablero público (SPEC §4.4 y §6).
 *
 * Se calculan de una sola pasada y se guardan en `ResumenIndicadores`
 * (corrección C-06): el SPEC §7 exige que el tablero cargue en menos de 3 s en
 * 4G, y agregar sobre la tabla cruda en cada visita no lo sostiene.
 *
 * El promedio de días hábiles se calcula en JavaScript y no en SQL a propósito:
 * necesita la tabla de festivos y el huso horario del municipio, que es la
 * misma lógica que fija las fechas límite. Duplicarla en SQL sería tener dos
 * definiciones de "día hábil" que se pueden desincronizar.
 */

export type Comparado = {
  valor: number
  anterior: number
  /** Cambio porcentual contra el periodo anterior; null si antes no había nada. */
  variacion: number | null
}

export type Promesa = {
  slug: string
  nombre: string
  icono: string
  slaDiasHabiles: number
  resueltos: number
  aTiempo: number
  cumplimiento: number | null
  diasPromedio: number | null
}

export type Indicadores = {
  generadoAt: string
  desde: string
  hasta: string
  meses: number
  resumen: {
    recibidos: Comparado
    resueltos: Comparado
    cumplimiento: Comparado
    calificacion: Comparado
  }
  tasas: { vencidos: number; reasignacion: number; reapertura: number }
  abiertos: number
  vencidosAhora: number
  promesas: Promesa[]
  porCategoria: { nombre: string; total: number }[]
  evolucionMensual: { mes: string; recibidos: number; resueltos: number }[]
  porEstatus: { estatus: EstatusReporte; total: number }[]
  puntualidadMensual: { mes: string; aTiempo: number; tarde: number }[]
  porOrigen: { origen: OrigenReporte; total: number }[]
  reasignadosMensual: { mes: string; total: number }[]
  calificaciones: { estrellas: number; total: number }[]
}


function comparar(valor: number, anterior: number): Comparado {
  return {
    valor,
    anterior,
    variacion: anterior === 0 ? null : ((valor - anterior) / anterior) * 100,
  }
}

/** Clave "2026-09" en la zona del municipio. */
const fmtMes = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' })
const claveMes = (d: Date) => fmtMes.format(d).slice(0, 7)

function mesesEntre(desde: Date, hasta: Date): string[] {
  const claves: string[] = []
  const cursor = new Date(desde)
  while (cursor <= hasta) {
    claves.push(claveMes(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  const ultimo = claveMes(hasta)
  if (claves[claves.length - 1] !== ultimo) claves.push(ultimo)
  return [...new Set(claves)]
}

export async function calcularIndicadores(meses = 12): Promise<Indicadores> {
  const hasta = new Date()
  const desde = new Date(hasta)
  desde.setMonth(desde.getMonth() - meses)
  const desdeAnterior = new Date(desde)
  desdeAnterior.setMonth(desdeAnterior.getMonth() - meses)

  const festivos = await cargarFestivos()

  const [
    recibidos, recibidosAntes,
    resueltosLista, resueltosAntesLista,
    califs, califsAntes,
    abiertos, vencidosAhora,
    porCategoria, porEstatus, porOrigen,
    calificaciones,
    reasignadosIds, reasignadosLista,
    reabiertosPeriodo, cerradosPeriodo,
    recibidosPorMes,
  ] = await Promise.all([
    prisma.reporte.count({ where: { createdAt: { gte: desde, lte: hasta } } }),
    prisma.reporte.count({ where: { createdAt: { gte: desdeAnterior, lt: desde } } }),

    // Se traen las fechas, no un conteo: el promedio de días hábiles lo hace JS.
    prisma.reporte.findMany({
      where: { resueltoAt: { gte: desde, lte: hasta } },
      select: { categoriaId: true, createdAt: true, resueltoAt: true, fechaLimite: true },
    }),
    prisma.reporte.findMany({
      where: { resueltoAt: { gte: desdeAnterior, lt: desde } },
      select: { resueltoAt: true, fechaLimite: true },
    }),

    prisma.reporte.aggregate({
      _avg: { calificacion: true },
      where: { calificacion: { not: null }, cerradoAt: { gte: desde, lte: hasta } },
    }),
    prisma.reporte.aggregate({
      _avg: { calificacion: true },
      where: { calificacion: { not: null }, cerradoAt: { gte: desdeAnterior, lt: desde } },
    }),

    prisma.reporte.count({ where: { estatus: { in: ESTATUS_ABIERTOS } } }),
    prisma.reporte.count({
      where: { estatus: { in: ESTATUS_ABIERTOS }, fechaLimite: { lt: hasta } },
    }),

    prisma.reporte.groupBy({
      by: ['categoriaId'], _count: true,
      where: { createdAt: { gte: desde, lte: hasta } },
    }),
    prisma.reporte.groupBy({ by: ['estatus'], _count: true }),
    prisma.reporte.groupBy({
      by: ['origen'], _count: true,
      where: { createdAt: { gte: desde, lte: hasta } },
    }),

    prisma.reporte.groupBy({
      by: ['calificacion'], _count: true,
      where: { calificacion: { not: null }, cerradoAt: { gte: desde, lte: hasta } },
    }),

    prisma.eventoReporte.findMany({
      where: { tipo: 'reasignado', timestamp: { gte: desde, lte: hasta } },
      select: { reporteId: true }, distinct: ['reporteId'],
    }),
    prisma.eventoReporte.findMany({
      where: { tipo: 'reasignado', timestamp: { gte: desde, lte: hasta } },
      select: { reporteId: true, timestamp: true },
    }),

    prisma.reporte.count({ where: { reabiertoAt: { gte: desde, lte: hasta } } }),
    prisma.reporte.count({ where: { cerradoAt: { gte: desde, lte: hasta } } }),

    prisma.reporte.findMany({
      where: { createdAt: { gte: desde, lte: hasta } },
      select: { createdAt: true },
    }),
  ])

  // ---------------------------------------------------------------- puntualidad
  const aTiempo = resueltosLista.filter((r) => r.resueltoAt! <= r.fechaLimite).length
  const aTiempoAntes = resueltosAntesLista.filter((r) => r.resueltoAt! <= r.fechaLimite).length

  const cumplimiento = resueltosLista.length ? (aTiempo / resueltosLista.length) * 100 : 0
  const cumplimientoAntes = resueltosAntesLista.length
    ? (aTiempoAntes / resueltosAntesLista.length) * 100
    : 0

  // ---------------------------------------------------------------- promesas
  const categorias = await prisma.categoria.findMany({
    orderBy: { orden: 'asc' },
    select: { id: true, slug: true, nombre: true, icono: true, slaDiasHabiles: true },
  })
  const porCat = new Map(categorias.map((c) => [c.id, c]))

  const promesas: Promesa[] = categorias.map((c) => {
    const suyos = resueltosLista.filter((r) => r.categoriaId === c.id)
    const puntuales = suyos.filter((r) => r.resueltoAt! <= r.fechaLimite).length
    const dias = suyos.map((r) => diasHabilesEntre(r.createdAt, r.resueltoAt!, festivos))
    return {
      slug: c.slug,
      nombre: c.nombre,
      icono: c.icono,
      slaDiasHabiles: c.slaDiasHabiles,
      resueltos: suyos.length,
      aTiempo: puntuales,
      cumplimiento: suyos.length ? (puntuales / suyos.length) * 100 : null,
      diasPromedio: dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : null,
    }
  })

  // ---------------------------------------------------------------- series mensuales
  const claves = mesesEntre(desde, hasta)
  const cuentaPorMes = (fechas: Date[]) => {
    const m = new Map(claves.map((k) => [k, 0]))
    for (const f of fechas) {
      const k = claveMes(f)
      if (m.has(k)) m.set(k, m.get(k)! + 1)
    }
    return m
  }

  const recibidosMes = cuentaPorMes(recibidosPorMes.map((r) => r.createdAt))
  const resueltosMes = cuentaPorMes(resueltosLista.map((r) => r.resueltoAt!))
  const reasignadosMes = cuentaPorMes(reasignadosLista.map((r) => r.timestamp))

  const puntualMes = new Map(claves.map((k) => [k, { aTiempo: 0, tarde: 0 }]))
  for (const r of resueltosLista) {
    const k = claveMes(r.resueltoAt!)
    const celda = puntualMes.get(k)
    if (!celda) continue
    if (r.resueltoAt! <= r.fechaLimite) celda.aTiempo++
    else celda.tarde++
  }

  return {
    generadoAt: new Date().toISOString(),
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    meses,
    resumen: {
      recibidos: comparar(recibidos, recibidosAntes),
      resueltos: comparar(resueltosLista.length, resueltosAntesLista.length),
      cumplimiento: comparar(cumplimiento, cumplimientoAntes),
      calificacion: comparar(califs._avg.calificacion ?? 0, califsAntes._avg.calificacion ?? 0),
    },
    tasas: {
      vencidos: abiertos ? (vencidosAhora / abiertos) * 100 : 0,
      reasignacion: recibidos ? (reasignadosIds.length / recibidos) * 100 : 0,
      reapertura: cerradosPeriodo ? (reabiertosPeriodo / cerradosPeriodo) * 100 : 0,
    },
    abiertos,
    vencidosAhora,
    promesas,
    porCategoria: porCategoria
      .map((g) => ({ nombre: porCat.get(g.categoriaId)?.nombre ?? '—', total: g._count }))
      .sort((a, b) => b.total - a.total),
    evolucionMensual: claves.map((k) => ({
      mes: k, recibidos: recibidosMes.get(k) ?? 0, resueltos: resueltosMes.get(k) ?? 0,
    })),
    porEstatus: porEstatus
      .map((g) => ({ estatus: g.estatus, total: g._count }))
      .sort((a, b) => b.total - a.total),
    puntualidadMensual: claves.map((k) => ({ mes: k, ...puntualMes.get(k)! })),
    porOrigen: porOrigen
      .map((g) => ({ origen: g.origen, total: g._count }))
      .sort((a, b) => b.total - a.total),
    reasignadosMensual: claves.map((k) => ({ mes: k, total: reasignadosMes.get(k) ?? 0 })),
    calificaciones: [1, 2, 3, 4, 5].map((n) => ({
      estrellas: n,
      total: calificaciones.find((c) => c.calificacion === n)?._count ?? 0,
    })),
  }
}

// ---------------------------------------------------------------- caché

const CLAVE = 'tablero-publico'
const FRESCURA_MS = 15 * 60 * 1000 // SPEC §7

/**
 * Indicadores del tablero, desde la tabla de resumen.
 *
 * Si el resumen está vencido se recalcula al vuelo, para que el tablero nunca
 * dependa de que la tarea programada haya corrido. Si el cálculo falla pero
 * hay un resumen viejo, se sirve ese: más vale un tablero de hace media hora
 * que una página rota.
 */
export async function obtenerIndicadores(): Promise<Indicadores> {
  const guardado = await prisma.resumenIndicadores.findUnique({ where: { clave: CLAVE } })
  const fresco = guardado && Date.now() - guardado.calculadoAt.getTime() < FRESCURA_MS
  if (fresco) return guardado.payload as unknown as Indicadores

  try {
    return await refrescarIndicadores()
  } catch (e) {
    if (guardado) return guardado.payload as unknown as Indicadores
    throw e
  }
}

export async function refrescarIndicadores(): Promise<Indicadores> {
  const datos = await calcularIndicadores()
  await prisma.resumenIndicadores.upsert({
    where: { clave: CLAVE },
    create: { clave: CLAVE, payload: datos as never, calculadoAt: new Date() },
    update: { payload: datos as never, calculadoAt: new Date() },
  })
  return datos
}
