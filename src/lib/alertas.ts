import { prisma } from '@/lib/prisma'
import { umbralesAlertas } from '@/lib/config'
import { ESTATUS_ABIERTOS } from '@/lib/presentacion'
import { enviarCorreoAlerta } from '@/lib/correo'
import type { TipoAlerta } from '@/generated/prisma/enums'

/**
 * Alertas internas (SPEC §4.5).
 *
 * Es la lección explícita del spec: «el sistema debe avisar cuando se degrada,
 * no esperar a que alguien lo note». Las tres condiciones son las que pide el
 * §4.5, con los umbrales configurables por variable de entorno.
 *
 * Dos decisiones que hacen la diferencia entre una alerta útil y ruido:
 *
 *  · **No se repiten.** Mientras una alerta siga sin resolver no se crea otra
 *    igual. Un cron cada 15 minutos que reenvía el mismo correo 96 veces al día
 *    consigue que la gente lo filtre, y entonces la alerta ya no sirve.
 *  · **Se cierran solas.** Cuando la condición deja de cumplirse, la alerta se
 *    marca resuelta. Un tablero lleno de alertas viejas es igual de inútil.
 */

export type AlertaEvaluada = {
  tipo: TipoAlerta
  clave: string
  mensaje: string
  detalle: Record<string, unknown>
}

const MS_SEMANA = 7 * 24 * 60 * 60 * 1000

/** Clave estable para no duplicar la misma alerta. */
function claveDe(tipo: TipoAlerta, sufijo = ''): string {
  return sufijo ? `${tipo}:${sufijo}` : tipo
}

// ---------------------------------------------------------------- detección

async function evaluarVencidos(): Promise<AlertaEvaluada | null> {
  const umbrales = umbralesAlertas()
  const [abiertos, vencidos] = await Promise.all([
    prisma.reporte.count({ where: { estatus: { in: ESTATUS_ABIERTOS } } }),
    prisma.reporte.count({
      where: { estatus: { in: ESTATUS_ABIERTOS }, fechaLimite: { lt: new Date() } },
    }),
  ])
  if (abiertos === 0) return null

  const pct = (vencidos / abiertos) * 100
  if (pct <= umbrales.vencidosPct) return null

  return {
    tipo: 'vencidos_sobre_umbral',
    clave: claveDe('vencidos_sobre_umbral'),
    mensaje: `${vencidos} de ${abiertos} reportes abiertos ya pasaron su fecha límite (${pct.toFixed(1)}%, el umbral es ${umbrales.vencidosPct}%).`,
    detalle: { vencidos, abiertos, porcentaje: pct, umbral: umbrales.vencidosPct },
  }
}

async function evaluarCalificacion(): Promise<AlertaEvaluada | null> {
  const umbrales = umbralesAlertas()
  const ahora = Date.now()
  const [semana, semanaPrevia] = await Promise.all([
    prisma.reporte.aggregate({
      _avg: { calificacion: true }, _count: { calificacion: true },
      where: { calificacion: { not: null }, cerradoAt: { gte: new Date(ahora - MS_SEMANA) } },
    }),
    prisma.reporte.aggregate({
      _avg: { calificacion: true }, _count: { calificacion: true },
      where: {
        calificacion: { not: null },
        cerradoAt: { gte: new Date(ahora - 2 * MS_SEMANA), lt: new Date(ahora - MS_SEMANA) },
      },
    }),
  ])

  const actual = semana._avg.calificacion
  const previa = semanaPrevia._avg.calificacion
  if (actual === null || previa === null) return null

  // Con dos o tres calificaciones cualquier promedio se mueve solo; alertar
  // por eso sería ruido garantizado.
  if (semana._count.calificacion < 5) return null

  const caida = previa - actual
  if (caida <= umbrales.caidaCalificacion) return null

  return {
    tipo: 'caida_calificacion',
    clave: claveDe('caida_calificacion'),
    mensaje: `La calificación ciudadana cayó de ${previa.toFixed(2)} a ${actual.toFixed(2)} estrellas en una semana (${caida.toFixed(2)} menos).`,
    detalle: {
      actual, previa, caida, umbral: umbrales.caidaCalificacion,
      calificacionesEstaSemana: semana._count.calificacion,
    },
  }
}

async function evaluarReaperturas(): Promise<AlertaEvaluada[]> {
  const umbrales = umbralesAlertas()
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const reabiertos = await prisma.reporte.groupBy({
    by: ['categoriaId'], _count: true,
    where: { reabiertoAt: { gte: inicioMes } },
  })

  const excedidas = reabiertos.filter((r) => r._count >= umbrales.reaperturasCategoria)
  if (excedidas.length === 0) return []

  const categorias = await prisma.categoria.findMany({
    where: { id: { in: excedidas.map((e) => e.categoriaId) } },
    select: { id: true, nombre: true },
  })
  const nombre = new Map(categorias.map((c) => [c.id, c.nombre]))

  return excedidas.map((e) => ({
    tipo: 'reaperturas_categoria' as const,
    clave: claveDe('reaperturas_categoria', String(e.categoriaId)),
    mensaje: `«${nombre.get(e.categoriaId) ?? 'Categoría'}» acumula ${e._count} reaperturas este mes: el trabajo se está cerrando sin quedar bien.`,
    detalle: { categoriaId: e.categoriaId, categoria: nombre.get(e.categoriaId), reaperturas: e._count, umbral: umbrales.reaperturasCategoria },
  }))
}

// ---------------------------------------------------------------- ciclo

export async function evaluarAlertas(): Promise<{
  nuevas: AlertaEvaluada[]
  resueltas: number
  activas: number
}> {
  const [vencidos, calificacion, reaperturas] = await Promise.all([
    evaluarVencidos(), evaluarCalificacion(), evaluarReaperturas(),
  ])

  const detectadas = [vencidos, calificacion, ...reaperturas].filter(
    (a): a is AlertaEvaluada => a !== null,
  )
  const clavesDetectadas = new Set(detectadas.map((a) => a.clave))

  const abiertas = await prisma.alertaInterna.findMany({
    where: { resueltaAt: null },
    select: { id: true, detalle: true, tipo: true },
  })
  const clavesAbiertas = new Map(
    abiertas.map((a) => [(a.detalle as { clave?: string } | null)?.clave ?? a.tipo, a.id]),
  )

  // Las que ya no aplican se cierran solas.
  const aResolver = [...clavesAbiertas.entries()]
    .filter(([clave]) => !clavesDetectadas.has(clave))
    .map(([, id]) => id)

  if (aResolver.length) {
    await prisma.alertaInterna.updateMany({
      where: { id: { in: aResolver } },
      data: { resueltaAt: new Date() },
    })
  }

  // Solo se crean las que no estaban ya abiertas.
  const nuevas = detectadas.filter((a) => !clavesAbiertas.has(a.clave))

  for (const a of nuevas) {
    await prisma.alertaInterna.create({
      data: {
        tipo: a.tipo,
        mensaje: a.mensaje,
        detalle: { ...a.detalle, clave: a.clave } as never,
      },
    })
  }

  if (nuevas.length) await enviarCorreoAlerta(nuevas)

  return {
    nuevas,
    resueltas: aResolver.length,
    activas: detectadas.length,
  }
}

export async function alertasActivas() {
  return prisma.alertaInterna.findMany({
    where: { resueltaAt: null },
    orderBy: { createdAt: 'desc' },
  })
}
