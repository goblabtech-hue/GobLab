import { aCivil, aInstante, claveCivil, diaSemana, sumarDiasCivil, type Civil } from './dias-habiles'

/**
 * Semanas del municipio (lunes a domingo).
 *
 * Vive en el dominio y no en la consulta porque el corte de la semana es una
 * decisión con consecuencias: si se calcula en UTC, en México —seis horas
 * detrás— todo lo resuelto un domingo después de las 6 de la tarde se contaría
 * en la semana siguiente. El director vería un informe que no cuadra con lo
 * que su cuadrilla recuerda haber hecho, y dejaría de confiar en el informe.
 *
 * Lunes porque así se organiza el trabajo: la junta es el lunes y lo que se
 * revisa es la semana que acaba de cerrar.
 */

export type Semana = {
  /** Lunes 00:00:00 del huso del municipio, como instante absoluto. */
  inicio: Date
  /** Lunes siguiente 00:00:00. Es exclusivo: se compara con `<`. */
  fin: Date
  /** Identificador estable para URLs: la fecha civil del lunes. */
  clave: string
}

/** La semana que contiene esa fecha. */
export function semanaDe(fecha: Date): Semana {
  const civil = aCivil(fecha)
  // diaSemana: 0 = domingo. El lunes queda a 1, y el domingo a 6 días atrás.
  const desplazamiento = (diaSemana(civil) + 6) % 7
  const lunes = sumarDiasCivil(civil, -desplazamiento)
  return desdeLunes(lunes)
}

/** La semana a partir de la clave que viaja en la URL (`2026-09-07`). */
export function semanaDeClave(clave: string): Semana | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clave)
  if (!m) return null
  const civil: Civil = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
  // Se normaliza al lunes de esa semana: una clave a media semana no debe
  // producir un rango de siete días desalineado del resto de los informes.
  return semanaDe(aInstante(civil, { h: 12 }))
}

export function semanaAnterior(s: Semana): Semana {
  return desdeLunes(sumarDiasCivil(aCivil(s.inicio), -7))
}

export function semanaSiguiente(s: Semana): Semana {
  return desdeLunes(sumarDiasCivil(aCivil(s.inicio), 7))
}

/** Las últimas `n` semanas, de la más reciente a la más antigua. */
export function ultimasSemanas(n: number, desde = new Date()): Semana[] {
  const semanas: Semana[] = []
  let s = semanaDe(desde)
  for (let i = 0; i < n; i++) {
    semanas.push(s)
    s = semanaAnterior(s)
  }
  return semanas
}

function desdeLunes(lunes: Civil): Semana {
  return {
    inicio: aInstante(lunes),
    fin: aInstante(sumarDiasCivil(lunes, 7)),
    clave: claveCivil(lunes),
  }
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/**
 * «Del 31 de agosto al 6 de septiembre de 2026».
 *
 * El domingo se calcula restando un día al fin exclusivo: mostrar el lunes
 * siguiente como último día de la semana confunde a cualquiera.
 */
export function etiquetaSemana(s: Semana): string {
  const a = aCivil(s.inicio)
  const b = aCivil(new Date(s.fin.getTime() - 1))

  if (a.m === b.m) return `del ${a.d} al ${b.d} de ${MESES[a.m - 1]} de ${a.y}`
  if (a.y === b.y) return `del ${a.d} de ${MESES[a.m - 1]} al ${b.d} de ${MESES[b.m - 1]} de ${a.y}`
  return `del ${a.d} de ${MESES[a.m - 1]} de ${a.y} al ${b.d} de ${MESES[b.m - 1]} de ${b.y}`
}

/** True si la semana todavía está corriendo: el informe está incompleto. */
export function enCurso(s: Semana, ahora = new Date()): boolean {
  return ahora < s.fin
}
