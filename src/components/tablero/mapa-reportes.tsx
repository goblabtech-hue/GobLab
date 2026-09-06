'use client'

import { useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { COLORES } from './graficas'
import type { Centro } from '@/components/mapa-selector'

/**
 * Mapa del tablero (SPEC §4.4c): integrado en la página, no en un iframe
 * aparte — es una de las debilidades de San Pedro que el proyecto corrige.
 *
 * La agrupación se hace por rejilla en el cliente en vez de con
 * `leaflet.markercluster`: son unos cientos de puntos, la rejilla es
 * determinista y una dependencia menos que mantener en un proyecto que tiene
 * que sobrevivir con presupuesto municipal.
 */

export type Punto = {
  folio: string
  lat: number
  lng: number
  categoria: string
  categoriaSlug: string
  estatus: string
  abierto: boolean
  vencido: boolean
  fecha: string
}

type Grupo = { lat: number; lng: number; puntos: Punto[] }

/** Tamaño de celda en grados, según el zoom: más zoom, celdas más finas. */
function tamanoCelda(zoom: number): number {
  return 360 / Math.pow(2, zoom + 3)
}

function agrupar(puntos: Punto[], zoom: number): Grupo[] {
  const celda = tamanoCelda(zoom)
  const mapa = new Map<string, Punto[]>()
  for (const p of puntos) {
    const clave = `${Math.floor(p.lat / celda)}:${Math.floor(p.lng / celda)}`
    const lista = mapa.get(clave)
    if (lista) lista.push(p)
    else mapa.set(clave, [p])
  }
  return [...mapa.values()].map((ps) => ({
    lat: ps.reduce((s, p) => s + p.lat, 0) / ps.length,
    lng: ps.reduce((s, p) => s + p.lng, 0) / ps.length,
    puntos: ps,
  }))
}

function colorDe(grupo: Grupo): string {
  if (grupo.puntos.some((p) => p.vencido)) return COLORES.rojo
  if (grupo.puntos.every((p) => !p.abierto)) return COLORES.verde
  return COLORES.ambar
}

function SeguirZoom({ onCambio }: { onCambio: (z: number) => void }) {
  const mapa = useMapEvents({ zoomend: () => onCambio(mapa.getZoom()) })
  return null
}

export function MapaReportes({
  puntos, categorias, centro,
}: {
  puntos: Punto[]
  categorias: { slug: string; nombre: string }[]
  centro: Centro
}) {
  const [zoom, setZoom] = useState(centro.zoom)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'abiertos' | 'resueltos' | 'vencidos'>('todos')

  const filtrados = useMemo(
    () =>
      puntos.filter((p) => {
        if (filtroCategoria && p.categoriaSlug !== filtroCategoria) return false
        if (filtroEstado === 'abiertos') return p.abierto
        if (filtroEstado === 'resueltos') return !p.abierto
        if (filtroEstado === 'vencidos') return p.vencido
        return true
      }),
    [puntos, filtroCategoria, filtroEstado],
  )

  const grupos = useMemo(() => agrupar(filtrados, zoom), [filtrados, zoom])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          aria-label="Filtrar por tipo de problema"
          className="h-10 rounded-lg border border-borde bg-papel px-3 text-sm"
        >
          <option value="">Todos los problemas</option>
          {categorias.map((c) => <option key={c.slug} value={c.slug}>{c.nombre}</option>)}
        </select>

        <div role="group" aria-label="Filtrar por estado" className="flex rounded-lg border border-borde bg-papel p-0.5">
          {([
            ['todos', 'Todos'],
            ['abiertos', 'Abiertos'],
            ['resueltos', 'Resueltos'],
            ['vencidos', 'Vencidos'],
          ] as const).map(([valor, texto]) => (
            <button
              key={valor} type="button" onClick={() => setFiltroEstado(valor)}
              aria-pressed={filtroEstado === valor}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                filtroEstado === valor ? 'bg-marca-600 text-white' : 'text-tinta-suave hover:bg-lienzo'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-tinta-suave" aria-live="polite">
        {filtrados.length} reportes en el mapa. Los círculos agrupan reportes
        cercanos: acércate para separarlos.
      </p>

      <MapContainer
        center={[centro.lat, centro.lng]}
        zoom={centro.zoom}
        scrollWheelZoom={false}
        className="h-[26rem] w-full rounded-lg border border-borde"
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <SeguirZoom onCambio={setZoom} />

        {grupos.map((g, i) => {
          const n = g.puntos.length
          const radio = n === 1 ? 7 : Math.min(26, 9 + Math.log2(n) * 4)
          const color = colorDe(g)
          return (
            <CircleMarker
              key={`${i}-${zoom}`}
              center={[g.lat, g.lng]}
              radius={radio}
              pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.85 }}
            >
              <Popup>
                {n === 1 ? (
                  <div className="text-sm">
                    <p className="font-semibold">{g.puntos[0].categoria}</p>
                    <p className="text-tinta-suave">{g.puntos[0].estatus} · {g.puntos[0].fecha}</p>
                    <a href={`/folio/${g.puntos[0].folio}`} className="font-mono underline">
                      {g.puntos[0].folio}
                    </a>
                  </div>
                ) : (
                  <div className="text-sm">
                    <p className="font-semibold">{n} reportes aquí</p>
                    <ul className="mt-1 max-h-40 overflow-y-auto">
                      {g.puntos.slice(0, 12).map((p) => (
                        <li key={p.folio}>
                          <a href={`/folio/${p.folio}`} className="underline">{p.categoria}</a>
                          <span className="text-tinta-suave"> · {p.fecha}</span>
                        </li>
                      ))}
                    </ul>
                    {n > 12 && <p className="mt-1 text-tinta-suave">y {n - 12} más…</p>}
                  </div>
                )}
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>

      <ul className="flex flex-wrap gap-4 text-sm text-tinta-suave">
        {([
          [COLORES.verde, 'Todos resueltos'],
          [COLORES.ambar, 'Con reportes abiertos'],
          [COLORES.rojo, 'Con reportes vencidos'],
        ] as const).map(([color, texto]) => (
          <li key={texto} className="flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{ background: color }} aria-hidden />
            {texto}
          </li>
        ))}
      </ul>
    </div>
  )
}
