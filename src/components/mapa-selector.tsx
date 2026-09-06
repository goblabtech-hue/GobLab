'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { municipioPublico } from '@/lib/config'

/**
 * Mapa para poner el pin del reporte.
 *
 * Se usa Leaflet + OpenStreetMap (SPEC §8): sin llaves de pago ni cuota, que
 * es lo que un presupuesto municipal pequeño puede sostener.
 *
 * El marcador es un divIcon en vez del ícono por omisión de Leaflet, que
 * depende de tres PNG resueltos por ruta relativa y se rompe con el empaquetado
 * de Next.
 */

const pin = L.divIcon({
  className: '',
  html: `<span style="
    display:block;width:28px;height:28px;margin:-28px 0 0 -14px;
    border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    background:#0d8465;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
})

function AlHacerClic({ onCambio }: { onCambio: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onCambio(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function Centrar({ lat, lng }: { lat: number | null; lng: number | null }) {
  const mapa = useMap()
  const anterior = useRef<string>('')
  useEffect(() => {
    if (lat == null || lng == null) return
    const clave = `${lat},${lng}`
    if (clave === anterior.current) return
    anterior.current = clave
    mapa.setView([lat, lng], Math.max(mapa.getZoom(), 16))
  }, [lat, lng, mapa])
  return null
}

export function MapaSelector({
  lat, lng, onCambio,
}: {
  lat: number | null
  lng: number | null
  onCambio: (lat: number, lng: number) => void
}) {
  // Sin guardia de montaje: este componente se importa con dynamic(ssr:false),
  // así que nunca se renderiza en el servidor.
  return (
    <MapContainer
      center={[lat ?? municipioPublico.centroLat, lng ?? municipioPublico.centroLng]}
      zoom={lat != null ? 16 : municipioPublico.zoomInicial}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-lg border border-borde"
      style={{ zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <AlHacerClic onCambio={onCambio} />
      <Centrar lat={lat} lng={lng} />
      {lat != null && lng != null && (
        <Marker
          position={[lat, lng]}
          icon={pin}
          draggable
          eventHandlers={{
            dragend(e) {
              const p = (e.target as L.Marker).getLatLng()
              onCambio(p.lat, p.lng)
            },
          }}
        />
      )}
    </MapContainer>
  )
}
