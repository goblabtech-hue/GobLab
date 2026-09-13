'use server'

import { revalidatePath } from 'next/cache'
import { requerirRol, NoAutorizado } from '@/infrastructure/auth'
import { aceptarReporte, rechazarReporte, ReglaDeNegocio } from '@/application/reportes'

export type Resultado = { ok?: true; error?: string }

const ROLES = ['operador', 'supervisor', 'admin'] as const

export async function registrar(_p: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const usuario = await requerirRol(...ROLES)
    const reporteId = String(datos.get('reporteId') ?? '')
    const categoriaId = Number(datos.get('categoriaId')) || undefined
    await aceptarReporte({
      reporteId, userId: usuario.id, categoriaId,
      ocultarContenido: datos.get('ocultarContenido') === 'on',
    })
    revalidatePath('/recepcion'); revalidatePath('/bandeja')
    return { ok: true }
  } catch (e) {
    if (e instanceof NoAutorizado) return { error: 'No tienes permiso para validar reportes.' }
    if (e instanceof ReglaDeNegocio) return { error: e.message }
    throw e
  }
}

export async function rechazar(_p: Resultado, datos: FormData): Promise<Resultado> {
  try {
    const usuario = await requerirRol(...ROLES)
    await rechazarReporte(String(datos.get('reporteId') ?? ''), usuario.id, String(datos.get('motivo') ?? ''))
    revalidatePath('/recepcion')
    return { ok: true }
  } catch (e) {
    if (e instanceof NoAutorizado) return { error: 'No tienes permiso para validar reportes.' }
    if (e instanceof ReglaDeNegocio) return { error: e.message }
    throw e
  }
}
