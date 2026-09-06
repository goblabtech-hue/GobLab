import fs from 'node:fs/promises'
import path from 'node:path'
import type { StorageProvider } from './provider'

/** Guarda en /public/uploads. Solo para desarrollo y despliegues de un servidor. */
export class LocalStorage implements StorageProvider {
  private readonly raiz = path.join(process.cwd(), 'public', 'uploads')

  async guardar(nombre: string, contenido: Buffer): Promise<string> {
    // Subcarpeta por mes: evita directorios con decenas de miles de archivos.
    const mes = new Date().toISOString().slice(0, 7)
    const dir = path.join(this.raiz, mes)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, nombre), contenido)
    return `/uploads/${mes}/${nombre}`
  }

  async borrar(url: string): Promise<void> {
    if (!url.startsWith('/uploads/')) return
    const destino = path.join(process.cwd(), 'public', url)
    // Defensa contra rutas con ".." que se salgan de /public/uploads
    if (!destino.startsWith(this.raiz)) return
    await fs.rm(destino, { force: true })
  }
}
