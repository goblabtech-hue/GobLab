import { PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { ErrorAlmacenamiento } from './errores'
import type { StorageProvider } from './provider'

/**
 * Almacenamiento S3 compatible: AWS S3, Cloudflare R2, MinIO, DigitalOcean
 * Spaces. Cualquiera sirve — el municipio elige por precio.
 *
 * `S3_ENDPOINT` es lo que permite usar algo distinto de AWS. `forcePathStyle`
 * va encendido porque MinIO y varios compatibles no soportan el estilo de
 * subdominio por bucket.
 *
 * `S3_PUBLIC_URL` existe porque la URL con la que se sube casi nunca es la
 * misma con la que se sirve: normalmente hay un CDN o un dominio propio
 * delante. Si no se define, se arma desde el endpoint.
 */
export class S3Storage implements StorageProvider {
  private readonly cliente: S3Client
  private readonly bucket: string
  private readonly urlPublica: string

  constructor() {
    const { S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env

    if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
      throw new ErrorAlmacenamiento(
        'Faltan S3_BUCKET, S3_ACCESS_KEY_ID o S3_SECRET_ACCESS_KEY. ' +
        'Usa STORAGE_DRIVER=local mientras tanto.',
      )
    }

    this.bucket = S3_BUCKET
    this.cliente = new S3Client({
      region: S3_REGION || 'auto',
      ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT, forcePathStyle: true } : {}),
      credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    })

    this.urlPublica = (process.env.S3_PUBLIC_URL || `${S3_ENDPOINT ?? ''}/${S3_BUCKET}`)
      .replace(/\/$/, '')
  }

  async guardar(nombre: string, contenido: Buffer, tipoMime: string): Promise<string> {
    // Misma partición por mes que el almacenamiento local: mantener las dos
    // implementaciones con la misma forma hace que migrar sea copiar archivos.
    const clave = `uploads/${new Date().toISOString().slice(0, 7)}/${nombre}`

    await this.cliente.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: clave,
      Body: contenido,
      ContentType: tipoMime,
      // Un año: los nombres llevan uuid, así que el contenido nunca cambia.
      CacheControl: 'public, max-age=31536000, immutable',
    }))

    return `${this.urlPublica}/${clave}`
  }

  async borrar(url: string): Promise<void> {
    if (!url.startsWith(this.urlPublica)) return
    const clave = url.slice(this.urlPublica.length + 1)
    if (!clave.startsWith('uploads/')) return

    await this.cliente.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: clave }))
  }
}
