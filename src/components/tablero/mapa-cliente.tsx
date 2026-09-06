'use client'

import dynamic from 'next/dynamic'
import type { Punto } from './mapa-reportes'
import type { Centro } from '@/components/mapa-selector'

/**
 * Envoltura de cliente para el mapa.
 *
 * Leaflet necesita `window`, así que se carga con `ssr: false`; y esa opción
 * solo se permite dentro de un componente de cliente, no en la página, que es
 * de servidor.
 */
const Mapa = dynamic(() => import('./mapa-reportes').then((m) => m.MapaReportes), {
  ssr: false,
  loading: () => (
    <div
      className="h-[26rem] w-full animate-pulse rounded-lg bg-lienzo"
      role="status" aria-label="Cargando el mapa"
    />
  ),
})

export function MapaCliente(props: {
  puntos: Punto[]
  categorias: { slug: string; nombre: string }[]
  centro: Centro
}) {
  return <Mapa {...props} />
}
