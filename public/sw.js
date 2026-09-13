/*
 * Service worker de DemosVoz.
 *
 * Hace poco a propósito. Un service worker que guarda páginas en caché es la
 * forma más fácil de que un ciudadano vea un folio viejo o una bandeja que
 * no es la suya. Aquí solo:
 *   · los archivos estáticos de Next (llevan hash en el nombre: nunca cambian)
 *     se sirven de caché primero;
 *   · todo lo demás va siempre a la red;
 *   · si no hay red al navegar, se muestra /sin-conexion.
 */
const VERSION = 'v1'
const ESTATICOS = `demosvoz-estaticos-${VERSION}`
const SIN_CONEXION = '/sin-conexion'

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(ESTATICOS).then((c) => c.addAll([SIN_CONEXION, '/marca/icono-192.png', '/marca/demosvoz.png'])),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== ESTATICOS).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Estáticos con hash: caché primero.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/marca/')) {
    e.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        const copia = res.clone()
        caches.open(ESTATICOS).then((c) => c.put(request, copia))
        return res
      })),
    )
    return
  }

  // Navegación: red, y si falla, la página de sin conexión.
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match(SIN_CONEXION)))
  }
})
