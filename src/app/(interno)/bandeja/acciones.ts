'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  asignarCuadrilla, reasignarDependencia, marcarImprocedente, marcarDuplicado,
  iniciarAtencion, ReglaDeNegocio,
} from '@/application/reportes'
import { prisma } from '@/infrastructure/prisma'
import { requerirRol, NoAutorizado, ROLES_VEN_TELEFONO } from '@/infrastructure/auth'
import { descifrarTelefono } from '@/domain/telefono'

export type Resultado = { ok?: boolean; error?: string }

/** Roles que pueden operar la bandeja. */
const OPERAN = ['operador', 'supervisor', 'admin'] as const

async function ejecutar(fn: (userId: string) => Promise<void>): Promise<Resultado> {
  try {
    const u = await requerirRol(...OPERAN)
    await fn(u.id)
    return { ok: true }
  } catch (e) {
    if (e instanceof NoAutorizado) return { error: 'No tienes permiso para esta acción.' }
    if (e instanceof ReglaDeNegocio) return { error: e.message }
    throw e
  }
}

function refrescar(folio: string) {
  revalidatePath('/bandeja')
  revalidatePath(`/bandeja/${folio}`)
  revalidatePath('/cuadrilla')
}

const idSchema = z.object({ reporteId: z.string().min(1), folio: z.string().min(1) })

export async function accionAsignar(_p: Resultado, datos: FormData): Promise<Resultado> {
  const base = idSchema.safeParse({ reporteId: datos.get('reporteId'), folio: datos.get('folio') })
  const cuadrillaId = String(datos.get('cuadrillaId') ?? '')
  if (!base.success || !cuadrillaId) return { error: 'Elige a quién se lo asignas.' }

  const r = await ejecutar((uid) => asignarCuadrilla(base.data.reporteId, cuadrillaId, uid))
  if (r.ok) refrescar(base.data.folio)
  return r
}

export async function accionReasignar(_p: Resultado, datos: FormData): Promise<Resultado> {
  const base = idSchema.safeParse({ reporteId: datos.get('reporteId'), folio: datos.get('folio') })
  const dependenciaId = Number(datos.get('dependenciaId'))
  const motivo = String(datos.get('motivo') ?? '')
  if (!base.success || !Number.isInteger(dependenciaId)) return { error: 'Elige la dependencia.' }

  const r = await ejecutar((uid) =>
    reasignarDependencia({ reporteId: base.data.reporteId, dependenciaId: dependenciaId, motivo: motivo, userId: uid }))
  if (r.ok) refrescar(base.data.folio)
  return r
}

export async function accionImprocedente(_p: Resultado, datos: FormData): Promise<Resultado> {
  const base = idSchema.safeParse({ reporteId: datos.get('reporteId'), folio: datos.get('folio') })
  const motivo = String(datos.get('motivo') ?? '')
  if (!base.success) return { error: 'Reporte inválido.' }

  const r = await ejecutar((uid) => marcarImprocedente(base.data.reporteId, motivo, uid))
  if (r.ok) refrescar(base.data.folio)
  return r
}

export async function accionDuplicado(_p: Resultado, datos: FormData): Promise<Resultado> {
  const base = idSchema.safeParse({ reporteId: datos.get('reporteId'), folio: datos.get('folio') })
  const originalId = String(datos.get('originalId') ?? '')
  if (!base.success || !originalId) return { error: 'Elige de cuál reporte es duplicado.' }

  const r = await ejecutar((uid) => marcarDuplicado(base.data.reporteId, originalId, uid))
  if (r.ok) refrescar(base.data.folio)
  return r
}

export async function accionIniciarAtencion(_p: Resultado, datos: FormData): Promise<Resultado> {
  const base = idSchema.safeParse({ reporteId: datos.get('reporteId'), folio: datos.get('folio') })
  if (!base.success) return { error: 'Reporte inválido.' }

  const r = await ejecutar((uid) => iniciarAtencion(base.data.reporteId, uid))
  if (r.ok) refrescar(base.data.folio)
  return r
}

/**
 * Descifra el teléfono de contacto para poder llamar al ciudadano.
 *
 * Es la única puerta al número completo y queda auditada: se registra quién lo
 * consultó y cuándo (SPEC §7 pide que el teléfono esté enmascarado salvo para
 * operadores; sin bitácora, "salvo para operadores" no se puede comprobar).
 */
export async function verTelefono(reporteId: string): Promise<{ telefono?: string; error?: string }> {
  try {
    const u = await requerirRol(...ROLES_VEN_TELEFONO)
    const r = await prisma.reporte.findUnique({
      where: { id: reporteId }, select: { telefonoCifrado: true },
    })
    if (!r?.telefonoCifrado) return { error: 'Este reporte no tiene teléfono de contacto.' }

    await prisma.eventoReporte.create({
      data: { reporteId, tipo: 'comentario', userId: u.id, detalle: { accion: 'consultó el teléfono' } },
    })
    return { telefono: descifrarTelefono(r.telefonoCifrado) }
  } catch (e) {
    if (e instanceof NoAutorizado) return { error: 'No tienes permiso para ver el teléfono.' }
    throw e
  }
}
