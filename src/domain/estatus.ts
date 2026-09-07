import type { EstatusReporte } from '@/generated/prisma/enums'

/**
 * Ciclo de vida del reporte (SPEC §4.2).
 *
 * Capa de dominio: la tabla de transiciones válidas y nada más. Lo que no está
 * declarado aquí, no se permite. Vive separado de los casos de uso para que se
 * pueda razonar —y probar— sin base de datos.
 */

export const TRANSICIONES: Record<EstatusReporte, EstatusReporte[]> = {
  nuevo:        ['asignado', 'en_atencion', 'duplicado', 'improcedente'],
  asignado:     ['en_atencion', 'resuelto', 'duplicado', 'improcedente'],
  en_atencion:  ['resuelto', 'asignado', 'duplicado', 'improcedente'],
  resuelto:     ['cerrado', 'reabierto'],
  cerrado:      ['reabierto'],
  reabierto:    ['en_atencion', 'resuelto', 'asignado'],
  duplicado:    [],
  improcedente: [],
}

export function puedeTransicionar(desde: EstatusReporte, hacia: EstatusReporte): boolean {
  return TRANSICIONES[desde].includes(hacia)
}

/** Estatus que cuentan como "reporte abierto". */
export const ESTATUS_ABIERTOS: EstatusReporte[] = [
  'nuevo', 'asignado', 'en_atencion', 'reabierto',
]

/** Estatus en los que el trabajo de campo ya terminó. */
export const ESTATUS_CERRADOS: EstatusReporte[] = ['resuelto', 'cerrado']
