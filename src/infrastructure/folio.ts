import { obtenerConfiguracion } from '@/infrastructure/config'
import { anioActual, formatearFolio } from '@/domain/folio'
import type { Prisma } from '@/generated/prisma/client'

/**
 * Reserva del número de folio (corrección C-04).
 *
 * El SPEC dice "secuencia anual" sin decir cómo. Derivarla de un COUNT(*) o de
 * un MAX(folio) es una condición de carrera: dos reportes simultáneos
 * —perfectamente posible con WhatsApp y web a la vez— obtendrían el mismo
 * número y el segundo INSERT reventaría contra el índice único. Se usa un
 * contador dedicado con UPSERT atómico: Postgres serializa los
 * INSERT ... ON CONFLICT DO UPDATE sobre la misma fila.
 */
export async function generarFolio(
  tx: Prisma.TransactionClient,
  fecha = new Date(),
): Promise<string> {
  const prefijo = (await obtenerConfiguracion()).prefijoFolio
  const anio = anioActual(fecha)

  const filas = await tx.$queryRaw<{ ultimo: number }[]>`
    INSERT INTO "FolioSecuencia" ("prefijo", "anio", "ultimo")
    VALUES (${prefijo}, ${anio}, 1)
    ON CONFLICT ("prefijo", "anio")
    DO UPDATE SET "ultimo" = "FolioSecuencia"."ultimo" + 1
    RETURNING "ultimo"
  `
  const fila = filas[0]
  if (!fila) throw new Error('La reserva del folio no devolvió número de secuencia.')
  return formatearFolio(prefijo, anio, Number(fila.ultimo))
}
