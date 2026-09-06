import type { NextConfig } from 'next'

/**
 * Cabeceras de seguridad.
 *
 * La CSP permite explícitamente lo que el sistema necesita y nada más: los
 * mosaicos de OpenStreetMap para el mapa y las imágenes propias.
 * `'unsafe-inline'` en estilos es inevitable con Tailwind y con los estilos que
 * Leaflet inyecta en línea.
 *
 * `frame-ancestors 'none'` importa más de lo que parece: sin ella cualquiera
 * puede meter la página de reportar en un iframe y engañar a un ciudadano para
 * que levante o cierre algo sin darse cuenta.
 *
 * En desarrollo se relaja con `'unsafe-eval'` y el websocket de recarga en
 * caliente, que React y Next necesitan solo en ese modo. La alternativa —una
 * CSP idéntica en los dos entornos— rompe el ciclo de desarrollo, y una regla
 * de seguridad que estorba todos los días acaba borrada por quien venga
 * después. En producción no se permite `eval`.
 */
const enDesarrollo = process.env.NODE_ENV !== 'production'

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${enDesarrollo ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self'${enDesarrollo ? ' ws: wss:' : ''}`,
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(enDesarrollo ? [] : ['upgrade-insecure-requests']),
].join('; ')

const cabeceras = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // El sistema no usa cámara ni micrófono desde el navegador; la ubicación sí,
  // pero solo la propia página.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
  // Solo tiene efecto sobre HTTPS, así que en desarrollo es inocua.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: '/:path*', headers: cabeceras },
      // Los datos abiertos se consumen desde cualquier origen a propósito
      // (SPEC §4.4g): son públicos y no traen nada personal.
      {
        source: '/api/datos-abiertos/:path*',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
    ]
  },
}

export default nextConfig
