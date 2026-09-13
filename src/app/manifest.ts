import type { MetadataRoute } from 'next'
import { obtenerConfiguracion } from '@/infrastructure/config'
import { TEMAS } from '@/domain/temas'

/**
 * La aplicación instalable (PWA).
 *
 * El ciudadano la agrega a su pantalla de inicio y abre a pantalla completa,
 * con ícono, sin barra del navegador. Es el mismo sitio: no hay una segunda
 * base de código que mantener, y el formulario ya usa cámara y GPS. Para las
 * tiendas de Apple y Google se envuelve este mismo sitio con Capacitor; ver
 * ROADMAP.md.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cfg = await obtenerConfiguracion()
  return {
    name: `DemosVoz · ${cfg.nombre}`,
    short_name: 'DemosVoz',
    description: `Reporta un problema de tu colonia en ${cfg.nombre} y sigue cómo se atiende.`,
    // Abre en «reportar»: es a lo que la gente entra a una app así.
    start_url: '/reportar?desde=app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'es-MX',
    background_color: '#ffffff',
    theme_color: TEMAS[cfg.tema].cabecera.fondo,
    icons: [
      { src: '/marca/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/marca/icono-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/marca/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Reportar un problema', url: '/reportar?desde=app', icons: [{ src: '/marca/icono-192.png', sizes: '192x192' }] },
      { name: 'Consultar mi folio', url: '/folio?desde=app' },
      { name: 'Cómo vamos', url: '/tablero?desde=app' },
    ],
  }
}
