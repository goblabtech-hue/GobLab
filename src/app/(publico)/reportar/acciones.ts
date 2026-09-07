'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { primerError } from '@/domain/validacion'
import { crearReporte, posiblesDuplicados, adherirse, ReglaDeNegocio } from '@/application/reportes'
import { guardarImagen, ImagenInvalida, MAX_FOTOS_CIUDADANO } from '@/infrastructure/almacenamiento'
import { telefonoValido } from '@/domain/telefono'
import { limitar } from '@/infrastructure/rate-limit'

/**
 * Alta de reporte desde el sitio público. Es el único punto del sistema donde
 * un anónimo escribe en la base, así que aquí van la validación estricta y el
 * límite de peticiones (SPEC §7).
 */

export type EstadoReporte = {
  error?: string
  campo?: string
}

const schema = z.object({
  categoriaId: z.coerce.number().int().positive('Elige qué tipo de problema es.'),
  descripcion: z.string().trim()
    .min(10, 'Cuéntanos un poco más: al menos 10 caracteres.')
    .max(2000, 'La descripción es demasiado larga.'),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  coloniaId: z.coerce.number().int().positive().nullable().optional(),
  direccionTexto: z.string().trim().max(300).optional(),
  telefono: z.string().trim().max(30).optional(),
  nombreContacto: z.string().trim().max(120).optional(),
})

function limpiarOpcional(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? undefined : s
}

export async function enviarReporte(
  _previo: EstadoReporte,
  datos: FormData,
): Promise<EstadoReporte> {
  const permitido = await limitar('reporte-web', 5, 60 * 60)
  if (!permitido) {
    return { error: 'Recibimos varios reportes desde aquí en poco tiempo. Espera un momento e inténtalo de nuevo.' }
  }

  const parsed = schema.safeParse({
    categoriaId: datos.get('categoriaId'),
    descripcion: datos.get('descripcion'),
    lat: limpiarOpcional(datos.get('lat')) ?? null,
    lng: limpiarOpcional(datos.get('lng')) ?? null,
    coloniaId: limpiarOpcional(datos.get('coloniaId')) ?? null,
    direccionTexto: limpiarOpcional(datos.get('direccionTexto')),
    telefono: limpiarOpcional(datos.get('telefono')),
    nombreContacto: limpiarOpcional(datos.get('nombreContacto')),
  })

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { error: primerError(parsed.error), campo: String(issue?.path[0] ?? '') }
  }
  const d = parsed.data

  // Ubicación: pin en el mapa o, como respaldo, la colonia (SPEC §4.1)
  const tieneCoordenadas = d.lat != null && d.lng != null
  if (!tieneCoordenadas && !d.coloniaId) {
    return {
      error: 'Necesitamos saber dónde está el problema: pon el pin en el mapa o elige tu colonia.',
      campo: 'ubicacion',
    }
  }

  if (d.telefono && !telefonoValido(d.telefono)) {
    return { error: 'Ese teléfono no parece de 10 dígitos. Revísalo o déjalo vacío.', campo: 'telefono' }
  }

  // Fotos
  const archivos = datos.getAll('fotos').filter((f): f is File => f instanceof File && f.size > 0)
  if (archivos.length > MAX_FOTOS_CIUDADANO) {
    return { error: `Puedes subir hasta ${MAX_FOTOS_CIUDADANO} fotos.`, campo: 'fotos' }
  }

  let fotos: string[] = []
  try {
    fotos = await Promise.all(archivos.map(guardarImagen))
  } catch (e) {
    if (e instanceof ImagenInvalida) return { error: e.message, campo: 'fotos' }
    throw e
  }

  let folio: string
  try {
    const r = await crearReporte({
      categoriaId: d.categoriaId,
      descripcion: d.descripcion,
      origen: 'web',
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      coloniaId: d.coloniaId ?? null,
      direccionTexto: d.direccionTexto ?? null,
      telefono: d.telefono ?? null,
      nombreContacto: d.nombreContacto ?? null,
      fotos,
    })
    folio = r.folio
  } catch (e) {
    if (e instanceof ReglaDeNegocio) return { error: e.message }
    throw e
  }

  redirect(`/folio/${folio}?nuevo=1`)
}

/** Reportes abiertos parecidos, para ofrecer adhesión antes de duplicar (SPEC §4.2). */
export async function cercanos(categoriaId: number, lat: number, lng: number) {
  if (!Number.isInteger(categoriaId) || !Number.isFinite(lat) || !Number.isFinite(lng)) return []
  const encontrados = await posiblesDuplicados(categoriaId, lat, lng)
  // Se devuelve solo lo que el ciudadano puede ver: nada de datos de contacto.
  return encontrados.slice(0, 3).map((r) => ({
    id: r.id,
    folio: r.folio,
    descripcion: r.descripcion,
    metros: Math.round(r.distanciaMetros),
    adhesiones: r.adhesiones,
    createdAt: r.createdAt.toISOString(),
  }))
}

export type EstadoAdhesion = { error?: string }

export async function unirseAReporte(
  _previo: EstadoAdhesion,
  datos: FormData,
): Promise<EstadoAdhesion> {
  const permitido = await limitar('adhesion', 10, 60 * 60)
  if (!permitido) return { error: 'Demasiados intentos. Espera un momento.' }

  const reporteId = String(datos.get('reporteId') ?? '')
  const telefono = String(datos.get('telefono') ?? '').trim()

  if (!telefono || !telefonoValido(telefono)) {
    return { error: 'Escribe tu teléfono a 10 dígitos para poder avisarte.' }
  }

  let folio: string
  try {
    const r = await adherirse(reporteId, telefono)
    folio = r.folio
  } catch (e) {
    if (e instanceof ReglaDeNegocio) return { error: e.message }
    throw e
  }

  redirect(`/folio/${folio}?unido=1`)
}
