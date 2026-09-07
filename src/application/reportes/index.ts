/**
 * Casos de uso del reporte.
 *
 * El archivo original pasaba de 550 líneas y mezclaba cinco responsabilidades.
 * Se dividió por lo que cambia junto; este índice mantiene intacta la
 * superficie pública para que quien importa `@/application/reportes` no note
 * la diferencia.
 */
export { ReglaDeNegocio } from './nucleo'
export { TRANSICIONES, puedeTransicionar, ESTATUS_ABIERTOS, ESTATUS_CERRADOS } from '@/domain/estatus'
export * from './alta'
export * from './triaje'
export * from './resolucion'
export * from './ciudadano'
export * from './mantenimiento'
