/**
 * Almacenamiento de imágenes tras una interfaz intercambiable (SPEC §8):
 * disco local en desarrollo, S3 compatible en producción.
 */

export type ArchivoGuardado = {
  url: string
  bytes: number
  ancho: number
  alto: number
}

export interface StorageProvider {
  /** Guarda una imagen ya validada y re-codificada. Devuelve su URL pública. */
  guardar(nombre: string, contenido: Buffer, tipoMime: string): Promise<string>
  borrar(url: string): Promise<void>
}

export const LIMITE_BYTES = 10 * 1024 * 1024 // SPEC §7: máx 10 MB
export const MIMES_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
export const MAX_FOTOS_CIUDADANO = 3 // SPEC §4.1
