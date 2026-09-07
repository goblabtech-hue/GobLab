import type { ZodError } from 'zod'

/**
 * Primer mensaje de error de una validación, listo para mostrarle a la persona.
 *
 * Zod devuelve un arreglo que en la práctica nunca viene vacío cuando la
 * validación falló, pero el tipo no lo garantiza. El respaldo evita repetir la
 * misma comprobación en cada acción de servidor.
 */
export function primerError(error: ZodError): string {
  return error.issues[0]?.message ?? 'Revisa los datos: hay algo que no cuadra.'
}
