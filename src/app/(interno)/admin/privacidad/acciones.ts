'use server'

import { revalidatePath } from 'next/cache'
import { requerirRol, NoAutorizado } from '@/infrastructure/auth'
import { guardarVersion, publicarVersion, ErrorAviso } from '@/application/privacidad'

export type Resultado = { ok?: boolean; error?: string; version?: number }

const LIMITE_BYTES = 1024 * 1024

/** Extensiones de texto plano. Un .docx es un ZIP: no se lee como texto. */
const EXTENSIONES = ['.txt', '.md', '.markdown']

export async function guardarAviso(_p: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const usuario = await requerirRol('admin')

    const archivo = datos.get('archivo')
    let contenido = String(datos.get('contenido') ?? '')

    // Si subieron un archivo, gana sobre lo escrito en el cuadro.
    if (archivo instanceof File && archivo.size > 0) {
      if (archivo.size > LIMITE_BYTES) {
        return { error: 'El archivo no puede pasar de 1 MB.' }
      }
      const nombre = archivo.name.toLowerCase()
      if (!EXTENSIONES.some((e) => nombre.endsWith(e))) {
        return {
          error: 'Sube un archivo .txt o .md. Si tienes un Word o un PDF, ' +
                 'abre el documento, copia el texto y pégalo en el cuadro de abajo.',
        }
      }
      contenido = Buffer.from(await archivo.arrayBuffer()).toString('utf8')
    }

    const aviso = await guardarVersion({
      titulo: String(datos.get('titulo') ?? ''),
      contenido,
      notaCambio: String(datos.get('notaCambio') ?? ''),
      autor: usuario.name ?? usuario.id,
      publicar: datos.get('publicar') === 'on',
    })

    revalidatePath('/admin/privacidad')
    revalidatePath('/privacidad')
    return { ok: true, version: aviso.version }
  } catch (e) {
    if (e instanceof NoAutorizado) return { error: 'Solo administración puede cambiar el aviso.' }
    if (e instanceof ErrorAviso) return { error: e.message }
    throw e
  }
}

export async function ponerEnVigor(datos: FormData): Promise<void> {
  await requerirRol('admin')
  const version = Number(datos.get('version'))
  if (Number.isInteger(version)) {
    await publicarVersion(version)
    revalidatePath('/admin/privacidad')
    revalidatePath('/privacidad')
  }
}
