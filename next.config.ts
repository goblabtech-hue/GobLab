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

/**
 * Origen público de las fotos.
 *
 * Con `STORAGE_DRIVER=local` las fotos se sirven desde `/uploads` y `'self'`
 * las cubre. Pero en un despliegue sin disco escribible (Vercel y cualquier
 * plataforma serverless) hay que usar almacenamiento externo, y entonces las
 * fotos viven en otro dominio. Sin declararlo aquí pasan dos cosas y las dos
 * son invisibles hasta que alguien sube una foto: la CSP bloquea la imagen sin
 * decir nada, y `next/image` revienta con "hostname is not configured".
 *
 * Se deriva de S3_PUBLIC_URL para no tener que mantener el dominio en tres
 * lugares. Tiene que estar disponible en tiempo de compilación.
 */
const almacenamiento = (() => {
  const crudo = process.env.S3_PUBLIC_URL?.trim()
  if (!crudo) return null
  try {
    const url = new URL(crudo)
    return { origen: url.origin, protocolo: url.protocol.replace(':', ''), host: url.hostname }
  } catch {
    // Una URL mal escrita no debe tumbar el build: se avisa y se sigue con
    // 'self', que es exactamente el síntoma que el mensaje describe.
    console.warn(`[next.config] S3_PUBLIC_URL no es una URL válida: ${crudo}`)
    return null
  }
})()

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${enDesarrollo ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.tile.openstreetmap.org${almacenamiento ? ` ${almacenamiento.origen}` : ''}`,
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

/**
 * Orígenes extra permitidos en desarrollo.
 *
 * Para probar el bot de Telegram hace falta un túnel (ngrok), y entonces el
 * navegador y los webhooks llegan con un `Host` que no es localhost. Next 16
 * rechaza eso en modo desarrollo salvo que el origen esté declarado aquí.
 *
 * Es una lista separada por comas en DEV_ORIGENES_PERMITIDOS, sin protocolo:
 *   DEV_ORIGENES_PERMITIDOS="abc123.ngrok-free.app"
 *
 * Solo aplica en desarrollo; en producción Next ignora esta opción.
 */
const origenesDev = (process.env.DEV_ORIGENES_PERMITIDOS ?? '')
  .split(',')
  .map((o) => o.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''))
  .filter(Boolean)

const nextConfig: NextConfig = {
  ...(origenesDev.length > 0 ? { allowedDevOrigins: origenesDev } : {}),

  ...(almacenamiento
    ? {
        images: {
          remotePatterns: [{
            protocol: almacenamiento.protocolo as 'http' | 'https',
            hostname: almacenamiento.host,
            pathname: '/**',
          }],
        },
      }
    : {}),

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
