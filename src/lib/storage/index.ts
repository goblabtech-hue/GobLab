import crypto from 'node:crypto'
import sharp from 'sharp'
import { LocalStorage } from './local'
import { S3Storage } from './s3'
import {
  LIMITE_BYTES, MIMES_PERMITIDOS, type StorageProvider,
} from './provider'

export * from './provider'
export { ErrorAlmacenamiento } from './errores'

let instancia: StorageProvider | null = null

export function storage(): StorageProvider {
  if (!instancia) {
    instancia = process.env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage()
  }
  return instancia
}

export class ImagenInvalida extends Error {}

/**
 * Valida y re-codifica una imagen subida (SPEC §7: "sanitización de archivos
 * subidos, solo imágenes, máx 10 MB, re-encode server-side").
 *
 * El re-encode no es cosmético: descarta metadatos EXIF —que incluyen la
 * ubicación GPS exacta de quien tomó la foto y que después se publica en la
 * galería antes/después— y garantiza que el archivo sea realmente una imagen
 * y no un ejecutable con extensión cambiada.
 */
export async function guardarImagen(archivo: File): Promise<string> {
  if (archivo.size === 0) throw new ImagenInvalida('El archivo está vacío.')
  if (archivo.size > LIMITE_BYTES) {
    throw new ImagenInvalida('Cada foto puede pesar máximo 10 MB.')
  }
  if (!MIMES_PERMITIDOS.includes(archivo.type)) {
    throw new ImagenInvalida('Solo se aceptan fotos (JPG, PNG, WEBP o HEIC).')
  }

  const entrada = Buffer.from(await archivo.arrayBuffer())

  let salida: Buffer
  try {
    salida = await sharp(entrada, { failOn: 'error' })
      .rotate()                                   // aplica la orientación EXIF y la descarta
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })       // re-codifica: no sobrevive nada del original
      .toBuffer()
  } catch {
    throw new ImagenInvalida('No pudimos leer esa foto. Intenta con otra.')
  }

  const nombre = `${crypto.randomUUID()}.jpg`
  return storage().guardar(nombre, salida, 'image/jpeg')
}
