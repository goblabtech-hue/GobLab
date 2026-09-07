'use server'

import { revalidatePath } from 'next/cache'
import { calificarReporte, reabrirReporte, ReglaDeNegocio } from '@/application/reportes'
import { limitar } from '@/infrastructure/rate-limit'

export type EstadoCalificacion = { error?: string; ok?: boolean; puedeReabrir?: boolean }

export async function calificar(
  _previo: EstadoCalificacion,
  datos: FormData,
): Promise<EstadoCalificacion> {
  if (!(await limitar('calificar', 20, 60 * 60))) {
    return { error: 'Demasiados intentos. Espera un momento.' }
  }

  const folio = String(datos.get('folio') ?? '')
  const estrellas = Number(datos.get('calificacion'))
  const comentario = String(datos.get('comentario') ?? '')

  try {
    const r = await calificarReporte(folio, estrellas, comentario)
    revalidatePath(`/folio/${folio}`)
    return { ok: true, puedeReabrir: r.puedeReabrir }
  } catch (e) {
    if (e instanceof ReglaDeNegocio) return { error: e.message }
    throw e
  }
}

export type EstadoReapertura = { error?: string; ok?: boolean }

export async function reabrir(
  _previo: EstadoReapertura,
  datos: FormData,
): Promise<EstadoReapertura> {
  if (!(await limitar('reabrir', 10, 60 * 60))) {
    return { error: 'Demasiados intentos. Espera un momento.' }
  }

  const folio = String(datos.get('folio') ?? '')
  const motivo = String(datos.get('motivo') ?? '')

  try {
    await reabrirReporte(folio, motivo)
    revalidatePath(`/folio/${folio}`)
    return { ok: true }
  } catch (e) {
    if (e instanceof ReglaDeNegocio) return { error: e.message }
    throw e
  }
}
