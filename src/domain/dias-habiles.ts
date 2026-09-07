
/**
 * Días hábiles y fecha límite (promesa de servicio).
 *
 * Capa de dominio: no importa Prisma ni Next. Recibe el conjunto de días
 * festivos como parámetro en vez de ir a buscarlo, que es lo que lo hace
 * probable sin base de datos y lo que exige la regla de inversión de
 * dependencias del CLAUDE.md.
 *
 * SPEC §5: fechaLimite = creación + slaDiasHabiles, saltando sábados, domingos
 * y días festivos.
 *
 * CORRECCIÓN C-09 (ver DECISIONES.md): "días hábiles" solo tiene sentido
 * contra un huso horario concreto. Un reporte creado el viernes 23:30 en el
 * centro de México es sábado 05:30 UTC; contando en UTC el sistema arrancaría
 * el reloj un día tarde. Toda la aritmética de este archivo se hace sobre
 * fechas civiles en MUNICIPIO_TZ, no sobre instantes UTC.
 */

/**
 * Huso horario del municipio. Se lee del entorno y no de la configuración en
 * base: define qué cuenta como día hábil, así que cambiarlo reinterpretaría
 * las fechas límite ya calculadas. Además mantiene puro este módulo.
 */
export const TZ = process.env.MUNICIPIO_TZ ?? 'America/Mexico_City'

export type Civil = { y: number; m: number; d: number }

const fmtCivil = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const fmtPartes = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Fecha civil (año/mes/día tal como se lee en el municipio) de un instante. */
export function aCivil(fecha: Date): Civil {
  const partes = fmtCivil.format(fecha).split('-').map(Number)
  const [y, m, d] = partes
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`No se pudo leer la fecha civil de ${fecha.toISOString()} en ${TZ}.`)
  }
  return { y, m, d }
}

/** "2026-09-06" — la llave que usamos para festivos y para agrupar por día. */
export function claveCivil(c: Civil): string {
  return `${c.y}-${String(c.m).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`
}

export function claveDeFecha(fecha: Date): string {
  return claveCivil(aCivil(fecha))
}

/** 0 = domingo … 6 = sábado. */
export function diaSemana(c: Civil): number {
  return new Date(Date.UTC(c.y, c.m - 1, c.d)).getUTCDay()
}

export function sumarDiasCivil(c: Civil, dias: number): Civil {
  const t = new Date(Date.UTC(c.y, c.m - 1, c.d))
  t.setUTCDate(t.getUTCDate() + dias)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

/** Milisegundos que hay que sumar a UTC para obtener la hora local en TZ. */
function desfaseTz(fecha: Date): number {
  const p = Object.fromEntries(
    fmtPartes.formatToParts(fecha).map((x) => [x.type, x.value]),
  ) as Record<string, string>
  const comoUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) === 24 ? 0 : Number(p.hour),
    Number(p.minute),
    Number(p.second),
  )
  // El formateador no da milisegundos, así que `comoUtc` está truncado al
  // segundo. Hay que truncar también el instante de referencia: comparar uno
  // truncado contra otro que sí trae ms mete ese sobrante en el desfase, y una
  // fecha límite de 23:59:59.999 terminaba cayendo en las 00:00 del día
  // siguiente. Los desfases horarios son de minutos completos, así que la
  // parte de milisegundos es la misma en UTC y en hora local.
  const truncado = fecha.getTime() - fecha.getUTCMilliseconds()
  return comoUtc - truncado
}

/**
 * Instante UTC que corresponde a una hora de pared en TZ.
 * Se itera dos veces para caer bien en los cambios de horario de verano.
 */
export type HoraPared = { h?: number; mi?: number; s?: number; ms?: number }

export function aInstante(c: Civil, hora: HoraPared = {}): Date {
  const { h = 0, mi = 0, s = 0, ms = 0 } = hora
  const pared = Date.UTC(c.y, c.m - 1, c.d, h, mi, s, ms)
  let t = pared
  for (let i = 0; i < 2; i++) t = pared - desfaseTz(new Date(t))
  return new Date(t)
}

export function esDiaHabil(c: Civil, festivos: ReadonlySet<string>): boolean {
  const dow = diaSemana(c)
  if (dow === 0 || dow === 6) return false
  return !festivos.has(claveCivil(c))
}

/**
 * Fecha límite: fin (23:59:59.999 hora local) del N-ésimo día hábil posterior
 * a la creación. Si el reporte nace en fin de semana o festivo, el conteo
 * empieza en el siguiente día hábil.
 */
export function calcularFechaLimite(
  creado: Date,
  slaDiasHabiles: number,
  festivos: ReadonlySet<string>,
): Date {
  let c = aCivil(creado)
  let restantes = Math.max(1, slaDiasHabiles)
  // tope defensivo: nunca iterar sin fin si la tabla de festivos viniera mal
  for (let paso = 0; paso < 3650 && restantes > 0; paso++) {
    c = sumarDiasCivil(c, 1)
    if (esDiaHabil(c, festivos)) restantes--
  }
  return aInstante(c, { h: 23, mi: 59, s: 59, ms: 999 })
}

/**
 * Días hábiles transcurridos entre dos instantes, contando fechas civiles.
 * Mismo día hábil => 0. El promedio sobre muchos reportes es el que produce
 * los decimales del tablero ("3.2 días").
 */
export function diasHabilesEntre(
  desde: Date,
  hasta: Date,
  festivos: ReadonlySet<string>,
): number {
  if (hasta < desde) return 0
  let c = aCivil(desde)
  const meta = claveCivil(aCivil(hasta))
  let cuenta = 0
  for (let paso = 0; paso < 3650; paso++) {
    if (claveCivil(c) === meta) break
    c = sumarDiasCivil(c, 1)
    if (esDiaHabil(c, festivos)) cuenta++
  }
  return cuenta
}

/** Semáforo de vencimiento del SPEC §4.2. */
export type Semaforo = 'verde' | 'ambar' | 'rojo'

export function semaforo(
  fechaLimite: Date,
  festivos: ReadonlySet<string>,
  ahora = new Date(),
): Semaforo {
  if (ahora > fechaLimite) return 'rojo'
  // ámbar cuando queda 1 día hábil o menos
  return diasHabilesEntre(ahora, fechaLimite, festivos) <= 1 ? 'ambar' : 'verde'
}
