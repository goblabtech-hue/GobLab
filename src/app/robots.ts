import type { MetadataRoute } from 'next'

/**
 * Qué puede indexar un buscador.
 *
 * En modo demostración se bloquea todo. El sitio lleva el nombre de un
 * municipio real y pide datos de contacto: si Google lo indexa, un vecino que
 * busque «reportar bache Tula» puede llegar aquí creyendo que es el
 * ayuntamiento, dejar su teléfono y quedarse esperando a una cuadrilla que
 * nunca va a salir.
 *
 * En la instalación real se abre todo salvo lo interno, que además exige
 * sesión: un buscador no debe gastar rastreo ahí ni exponer las rutas.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.MODO_DEMO === 'true') {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/bandeja', '/cuadrilla', '/ejecutivo', '/moderacion', '/admin', '/api/'],
    },
  }
}
