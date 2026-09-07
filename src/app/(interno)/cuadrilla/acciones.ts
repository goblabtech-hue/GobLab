'use server'

import { revalidatePath } from 'next/cache'
import { iniciarAtencion, resolverReporte, ReglaDeNegocio } from '@/application/reportes'
import { requerirRol, NoAutorizado } from '@/infrastructure/auth'
import { guardarImagen, ImagenInvalida } from '@/infrastructure/almacenamiento'

export type Resultado = { ok?: boolean; error?: string }

const RESUELVEN = ['cuadrilla', 'supervisor', 'admin'] as const

export async function empezar(_p: Resultado, datos: FormData): Promise<Resultado> {
  const reporteId = String(datos.get('reporteId') ?? '')
  const folio = String(datos.get('folio') ?? '')
  try {
    const u = await requerirRol(...RESUELVEN)
    await iniciarAtencion(reporteId, u.id)
    revalidatePath(`/cuadrilla/${folio}`)
    revalidatePath('/cuadrilla')
    return { ok: true }
  } catch (e) {
    if (e instanceof NoAutorizado) return { error: 'No tienes permiso.' }
    if (e instanceof ReglaDeNegocio) return { error: e.message }
    throw e
  }
}

/**
 * Cierre de campo. La validación de evidencia vive en `resolverReporte`, no
 * aquí: es una regla del dominio (SPEC §5), no del formulario, y tiene que
 * valer igual si mañana el cierre llega por la app de la cuadrilla o por el bot.
 */
export async function resolver(_p: Resultado, datos: FormData): Promise<Resultado> {
  const reporteId = String(datos.get('reporteId') ?? '')
  const folio = String(datos.get('folio') ?? '')
  const nota = String(datos.get('notaCierre') ?? '')

  const archivos = datos.getAll('evidencia').filter((f): f is File => f instanceof File && f.size > 0)

  try {
    const u = await requerirRol(...RESUELVEN)

    let urls: string[] = []
    try {
      urls = await Promise.all(archivos.map(guardarImagen))
    } catch (e) {
      if (e instanceof ImagenInvalida) return { error: e.message }
      throw e
    }

    await resolverReporte({ reporteId: reporteId, userId: u.id, fotosEvidencia: urls, notaCierre: nota })
    revalidatePath(`/cuadrilla/${folio}`)
    revalidatePath('/cuadrilla')
    revalidatePath(`/bandeja/${folio}`)
    return { ok: true }
  } catch (e) {
    if (e instanceof NoAutorizado) return { error: 'No tienes permiso.' }
    if (e instanceof ReglaDeNegocio) return { error: e.message }
    throw e
  }
}
