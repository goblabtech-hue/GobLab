import { prisma } from '@/lib/prisma'

/**
 * Configuración del municipio.
 *
 * Lo que un administrador municipal querría cambiar alguna vez —el nombre, el
 * prefijo del folio, dónde se centra el mapa, el teléfono de emergencias— vive
 * en la base y se edita en `/admin/municipio`. Pedirle a alguien que edite un
 * archivo y reinicie el servidor para corregir una palabra no es una opción
 * realista en un municipio.
 *
 * Lo que NO se puede cambiar desde la interfaz, a propósito:
 *
 *  · **El huso horario** (`MUNICIPIO_TZ`). Define qué es un día hábil, así que
 *    cambiarlo reinterpreta la fecha límite de todos los reportes que ya
 *    existen. Un municipio no cambia de huso horario; ponerlo a un clic sería
 *    ofrecer una forma fácil de romper el histórico.
 *  · **Las llaves y credenciales.** Son secretos: no deben poder leerse desde
 *    una pantalla.
 */

function num(valor: string | undefined, porDefecto: number): number {
  const n = Number(valor)
  return Number.isFinite(n) ? n : porDefecto
}

export type ConfigMunicipio = {
  nombre: string
  prefijoFolio: string
  centroLat: number
  centroLng: number
  zoomInicial: number
  telEmergencias: string
}

/** Valores de arranque: solo se usan si todavía no hay fila en la base. */
export const CONFIG_POR_DEFECTO: ConfigMunicipio = {
  nombre: process.env.MUNICIPIO_NOMBRE ?? 'Municipio Demo',
  prefijoFolio: process.env.MUNICIPIO_PREFIJO_FOLIO ?? 'MUN',
  centroLat: num(process.env.MUNICIPIO_CENTRO_LAT, 19.4326),
  centroLng: num(process.env.MUNICIPIO_CENTRO_LNG, -99.1332),
  zoomInicial: num(process.env.MUNICIPIO_ZOOM_INICIAL, 13),
  telEmergencias: process.env.TEL_EMERGENCIAS ?? '911',
}

let cache: { valor: ConfigMunicipio; leidaEn: number } | null = null
const TTL_MS = 60_000

/**
 * Configuración vigente. Se cachea un minuto: se lee en casi cada request y
 * cambia una vez cada varios meses.
 */
export async function obtenerConfiguracion(): Promise<ConfigMunicipio> {
  if (cache && Date.now() - cache.leidaEn < TTL_MS) return cache.valor

  try {
    const fila = await prisma.configuracionMunicipio.findUnique({ where: { id: 1 } })
    const valor: ConfigMunicipio = fila
      ? {
          nombre: fila.nombre,
          prefijoFolio: fila.prefijoFolio,
          centroLat: fila.centroLat,
          centroLng: fila.centroLng,
          zoomInicial: fila.zoomInicial,
          telEmergencias: fila.telEmergencias,
        }
      : CONFIG_POR_DEFECTO
    cache = { valor, leidaEn: Date.now() }
    return valor
  } catch {
    // Si la base no responde, el sitio sigue de pie con los valores de arranque.
    return cache?.valor ?? CONFIG_POR_DEFECTO
  }
}

export function invalidarConfiguracion() {
  cache = null
}

/**
 * Huso horario del municipio. Se queda en variable de entorno: define qué es
 * un día hábil y cambiarlo reinterpretaría todas las fechas límite existentes.
 */
export const TZ_MUNICIPIO = process.env.MUNICIPIO_TZ ?? 'America/Mexico_City'

// ---------------------------------------------------------------- operación

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
