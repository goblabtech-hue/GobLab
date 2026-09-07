import { prisma } from '@/infrastructure/prisma'
import { duplicados as cfg } from '@/infrastructure/config'
import { distanciaMetros } from '@/domain/distancia'
import { ESTATUS_ABIERTOS } from '@/domain/estatus'
import type { EstatusReporte } from '@/generated/prisma/enums'

/**
 * Busca reportes abiertos que probablemente sean el mismo problema (SPEC §4.2).
 *
 * Se prefiltra en SQL con una caja delimitadora (barata, usa el índice) y
 * después se aplica Haversine en memoria, que es el filtro exacto: una caja de
 * ±100 m incluye esquinas de hasta ~141 m que no deben contar.
 */

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

export type BusquedaDuplicados = {
  categoriaId: number
  lat: number | null
  lng: number | null
  excluirReporteId?: string
  radioMetros?: number
  ventanaDias?: number
}

export async function buscarDuplicados(params: BusquedaDuplicados): Promise<Candidato[]> {
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
      id: true, folio: true, descripcion: true, estatus: true, createdAt: true,
      lat: true, lng: true,
      _count: { select: { adhesiones: true } },
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
  })

  return cercanos
    .flatMap((r) => {
      if (r.lat == null || r.lng == null) return []
      return [{
        id: r.id,
        folio: r.folio,
        descripcion: r.descripcion,
        estatus: r.estatus,
        createdAt: r.createdAt,
        lat: r.lat,
        lng: r.lng,
        distanciaMetros: distanciaMetros({ lat: lat, lng: lng }, { lat: r.lat, lng: r.lng }),
        adhesiones: r._count.adhesiones,
      }]
    })
    .filter((r) => r.distanciaMetros <= radio)
    .sort((a, b) => a.distanciaMetros - b.distanciaMetros)
}
