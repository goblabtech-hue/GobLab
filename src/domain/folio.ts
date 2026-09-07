import { TZ } from '@/domain/dias-habiles'

/**
 * Formato del folio (SPEC §4.1): {{PREFIJO}}-AAAA-NNNNN.
 *
 * Capa de dominio: solo formato y calendario. La reserva del número, que toca
 * la base, vive en `infrastructure/folio.ts`.
 */

const anioFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric' })

export function anioActual(fecha = new Date()): number {
  return Number(anioFmt.format(fecha))
}

export function formatearFolio(prefijo: string, anio: number, n: number): string {
  return `${prefijo}-${anio}-${String(n).padStart(5, '0')}`
}
