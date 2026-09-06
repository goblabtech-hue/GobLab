/**
 * Configuración del municipio y umbrales operativos.
 *
 * SPEC §Notas finales: "No inventes datos del municipio: usa los placeholders".
 * Por eso TODO valor municipal se lee de variables de entorno; los defaults de
 * abajo son de demostración y están listados en PENDIENTES.md para que el
 * equipo los sustituya. Ningún dato municipal está escrito en el código.
 */

function num(valor: string | undefined, porDefecto: number): number {
  const n = Number(valor)
  return Number.isFinite(n) ? n : porDefecto
}

export const municipio = {
  nombre: process.env.MUNICIPIO_NOMBRE ?? 'Municipio Demo',
  prefijoFolio: process.env.MUNICIPIO_PREFIJO_FOLIO ?? 'MUN',
  centroLat: num(process.env.MUNICIPIO_CENTRO_LAT, 19.4326),
  centroLng: num(process.env.MUNICIPIO_CENTRO_LNG, -99.1332),
  zoomInicial: num(process.env.MUNICIPIO_ZOOM_INICIAL, 13),
  telEmergencias: process.env.TEL_EMERGENCIAS ?? '911',
}

/** Espejo seguro para componentes de cliente (mapa). */
export const municipioPublico = {
  nombre: process.env.NEXT_PUBLIC_MUNICIPIO_NOMBRE ?? 'Municipio Demo',
  centroLat: num(process.env.NEXT_PUBLIC_MUNICIPIO_CENTRO_LAT, 19.4326),
  centroLng: num(process.env.NEXT_PUBLIC_MUNICIPIO_CENTRO_LNG, -99.1332),
  zoomInicial: num(process.env.NEXT_PUBLIC_MUNICIPIO_ZOOM_INICIAL, 13),
  telEmergencias: process.env.NEXT_PUBLIC_TEL_EMERGENCIAS ?? '911',
}

export const duplicados = {
  radioMetros: num(process.env.DUPLICADOS_RADIO_METROS, 100),
  ventanaDias: num(process.env.DUPLICADOS_VENTANA_DIAS, 30),
}

/**
 * Umbrales de las alertas internas (SPEC §4.5).
 *
 * Es una función y no una constante a propósito: leerlos en cada evaluación
 * permite ajustarlos sin reiniciar el servidor, y hace que se puedan probar
 * sin trucos con la caché de módulos.
 */
export function umbralesAlertas() {
  return {
    vencidosPct: num(process.env.ALERTA_VENCIDOS_PCT, 20),
    caidaCalificacion: num(process.env.ALERTA_CAIDA_CALIFICACION, 0.5),
    reaperturasCategoria: num(process.env.ALERTA_REAPERTURAS_CATEGORIA, 3),
  }
}

/** Días naturales tras `resuelto` para el autocierre (SPEC §4.3). */
export const DIAS_AUTOCIERRE = 3

/** Calificación en la que se ofrece reabrir (SPEC §4.2). */
export const CALIFICACION_REAPERTURA = 2

/** Un reporte solo puede reabrirse una vez (SPEC §4.2). */
export const MAX_REAPERTURAS = 1
