'use server'

import { revalidatePath } from 'next/cache'
import { moderarPublicacion, ReglaDeNegocio } from '@/application/reportes'
import { requerirRol, NoAutorizado } from '@/infrastructure/auth'

export type Resultado = { ok?: boolean; error?: string }

/**
 * Moderación de la galería pública (SPEC §4.4f).
 *
 * Solo supervisión y administración: es la decisión de exponer o no la foto
 * que mandó un vecino, y no debería poder tomarla quien la subió.
 */
export async function decidirPublicacion(
  _previo: Resultado, datos: FormData,
): Promise<Resultado> {
  const reporteId = String(datos.get('reporteId') ?? '')
  const publicable = datos.get('decision') === 'publicar'

  try {
    const u = await requerirRol('supervisor', 'admin')
    await moderarPublicacion(reporteId, publicable, u.id)
    revalidatePath('/moderacion')
    revalidatePath('/antes-despues')
    revalidatePath('/tablero')
    return { ok: true }
  } catch (e) {
    if (e instanceof NoAutorizado) return { error: 'No tienes permiso para moderar.' }
    if (e instanceof ReglaDeNegocio) return { error: e.message }
    throw e
  }
}
