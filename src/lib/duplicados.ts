import { prisma } from '@/lib/prisma'
import { duplicados as cfg } from '@/lib/config'
import type { EstatusReporte } from '@/generated/prisma/enums'

/**
 * Detección de duplicados por cercanía (SPEC §4.2): reportes abiertos de la
 * misma categoría dentro de un radio configurable (100 m por omisión) en los
 * últimos 30 días.
 */

const RADIO_TIERRA_M = 6_371_000

/** Distancia en metros entre dos coordenadas (Haversine). */
export function distanciaMetros(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLng = (bLng - aLng) * rad
  const lat1 = aLat * rad
  const lat2 = bLat * rad

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Estatus que cuentan como "reporte abierto" para efectos de duplicados. */
export const ESTATUS_ABIERTOS: EstatusReporte[] = [
  'nuevo',
  'asignado',
  'en_atencion',
  'reabierto',
]

export type Candidato = {
  id: string
  folio: string
  descripcion: string
  estatus: EstatusReporte
  createdAt: Date
  lat: number
  lng: number
  distanciaMetros: number
  adhesiones: number
}

/**
 * Busca reportes abiertos que probablemente sean el mismo problema.
 *
 * Se prefiltra en SQL con una caja delimitadora (barata, usa el índice) y
 * después se aplica Haversine en memoria, que es el filtro exacto: una caja
 * de ±100 m incluye esquinas de hasta ~141 m que no deben contar.
 */
export async function buscarDuplicados(params: {
  categoriaId: number
  lat: number | null
  lng: number | null
  excluirReporteId?: string
  radioMetros?: number
  ventanaDias?: number
}): Promise<Candidato[]> {
  const { categoriaId, lat, lng, excluirReporteId } = params
  if (lat == null || lng == null) return []

  const radio = params.radioMetros ?? cfg.radioMetros
  const ventanaDias = params.ventanaDias ?? cfg.ventanaDias

  const gradosLat = radio / 111_320
  const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180))
  const gradosLng = radio / (111_320 * cosLat)

  const desde = new Date(Date.now() - ventanaDias * 24 * 60 * 60 * 1000)

  const cercanos = await prisma.reporte.findMany({
    where: {
      categoriaId,
      estatus: { in: ESTATUS_ABIERTOS },
      createdAt: { gte: desde },
      lat: { gte: lat - gradosLat, lte: lat + gradosLat },
      lng: { gte: lng - gradosLng, lte: lng + gradosLng },
      ...(excluirReporteId ? { id: { not: excluirReporteId } } : {}),
    },
    select: {
      id: true,
      folio: true,
      descripcion: true,
      estatus: true,
      createdAt: true,
      lat: true,
      lng: true,
      _count: { select: { adhesiones: true } },
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
  })

  return cercanos
    .map((r) => ({
      id: r.id,
      folio: r.folio,
      descripcion: r.descripcion,
      estatus: r.estatus,
      createdAt: r.createdAt,
      lat: r.lat!,
      lng: r.lng!,
      distanciaMetros: distanciaMetros(lat, lng, r.lat!, r.lng!),
      adhesiones: r._count.adhesiones,
    }))
    .filter((r) => r.distanciaMetros <= radio)
    .sort((a, b) => a.distanciaMetros - b.distanciaMetros)
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
