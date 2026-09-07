import { prisma } from '@/infrastructure/prisma'

/**
 * Adaptador de persistencia para los días festivos.
 *
 * Vive aquí y no en el dominio porque va a la base. El dominio
 * (`domain/dias-habiles.ts`) recibe el conjunto ya cargado.
 */

let cache: { valorEn: number; set: Set<string> } | null = null
const TTL_MS = 5 * 60 * 1000

export async function cargarFestivos(): Promise<ReadonlySet<string>> {
  if (cache && Date.now() - cache.valorEn < TTL_MS) return cache.set

  const filas = await prisma.diaFestivo.findMany({ select: { fecha: true } })
  const set = new Set(
    filas.map((f) => {
      // columna DATE: se guarda a medianoche UTC, se lee tal cual
      const d = f.fecha
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate(),
      ).padStart(2, '0')}`
    }),
  )
  cache = { valorEn: Date.now(), set }
  return set
}

export function invalidarCacheFestivos() {
  cache = null
}
