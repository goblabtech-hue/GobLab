import crypto from 'node:crypto'
import sharp, { type Sharp } from 'sharp'
import { storage } from './index'
import { ImagenInvalida } from './index'
import { LIMITE_BYTES, MIMES_PERMITIDOS } from './provider'

/**
 * Prepara el logotipo de un municipio para la cabecera.
 *
 * El escudo llega como lo tenga el ayuntamiento: un JPEG con fondo blanco y
 * márgenes, casi siempre. Aquí se recorta el margen, se vuelve transparente
 * el fondo blanco —un JPEG sobre una cabecera guinda sería un rectángulo
 * blanco— y se genera una versión en blanco de la misma silueta para los
 * temas oscuros. Es el mismo tratamiento que se le dio al logotipo de la
 * plataforma, automatizado.
 *
 * Si el archivo ya trae transparencia (PNG), se respeta y solo se recorta.
 */
export async function guardarLogotipo(archivo: File): Promise<{ color: string; blanco: string }> {
  if (archivo.size === 0) throw new ImagenInvalida('El archivo está vacío.')
  if (archivo.size > LIMITE_BYTES) throw new ImagenInvalida('El logotipo puede pesar máximo 10 MB.')
  if (!MIMES_PERMITIDOS.includes(archivo.type) && archivo.type !== 'image/svg+xml') {
    throw new ImagenInvalida('Sube el logotipo como PNG, JPG, WEBP o SVG.')
  }

  const entrada = Buffer.from(await archivo.arrayBuffer())
  let base: Sharp
  try {
    base = sharp(entrada, { failOn: 'error' })
      .rotate()
      .trim({ threshold: 20 })
      .resize({ height: 240, withoutEnlargement: true })
  } catch {
    throw new ImagenInvalida('No pudimos leer ese archivo. Intenta con otro.')
  }

  const { data, info } = await base.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const color = Buffer.from(data)
  const blanco = Buffer.from(data)
  const traeAlpha = archivo.type === 'image/png' || archivo.type === 'image/webp' || archivo.type === 'image/svg+xml'

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!, a = data[i + 3]!
    let alpha = a
    if (!traeAlpha || a === 255) {
      // Fondo blanco → transparente, con borde suave para tragarse los halos
      // que deja el JPEG alrededor de las formas.
      const lum = (r + g + b) / 3
      if (r > 235 && g > 235 && b > 235) alpha = 0
      else if (lum > 200) alpha = Math.round(255 * (255 - lum) / 55)
    }
    color[i + 3] = alpha
    blanco[i] = 255; blanco[i + 1] = 255; blanco[i + 2] = 255; blanco[i + 3] = alpha
  }

  const raw = { raw: { width: info.width, height: info.height, channels: 4 as const } }
  const [pngColor, pngBlanco] = await Promise.all([
    sharp(color, raw).png().toBuffer(),
    sharp(blanco, raw).png().toBuffer(),
  ])
  const id = crypto.randomUUID()
  return {
    color: await storage().guardar(`logo-${id}.png`, pngColor, 'image/png'),
    blanco: await storage().guardar(`logo-${id}-blanco.png`, pngBlanco, 'image/png'),
  }
}
