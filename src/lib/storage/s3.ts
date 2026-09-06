import type { StorageProvider } from './provider'

/**
 * Almacenamiento S3 compatible (S3, R2, MinIO, Spaces).
 *
 * Sin implementar: requiere `@aws-sdk/client-s3`, que se instala cuando el
 * municipio decida el proveedor. La interfaz ya está fijada para que el cambio
 * sea de una línea en storage/index.ts. Ver PENDIENTES.md §4.
 */
export class S3Storage implements StorageProvider {
  constructor() {
    throw new Error(
      'STORAGE_DRIVER=s3 todavía no está implementado. ' +
      'Usa STORAGE_DRIVER=local o implementa src/lib/storage/s3.ts.',
    )
  }
  async guardar(): Promise<string> { throw new Error('no implementado') }
  async borrar(): Promise<void> { throw new Error('no implementado') }
}
