/**
 * Geometría para la detección de duplicados (SPEC §4.2).
 *
 * Capa de dominio: funciones puras, sin base de datos. La consulta vive en
 * `application/duplicados.ts`.
 */

const RADIO_TIERRA_M = 6_371_000

/** Un punto en el mapa. Cuatro números sueltos se confunden entre sí. */
export type Punto = { lat: number; lng: number }

/** Distancia en metros entre dos puntos (Haversine). */
export function distanciaMetros(a: Punto, b: Punto): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const lat1 = a.lat * rad
  const lat2 = b.lat * rad

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Prioridad derivada del número de adhesiones (SPEC §4.2: "Los reportes con
 * más adhesiones suben de prioridad").
 */
export function prioridadPorAdhesiones(
  adhesiones: number,
): 'normal' | 'alta' | 'urgente' {
  if (adhesiones >= 10) return 'urgente'
  if (adhesiones >= 3) return 'alta'
  return 'normal'
}
