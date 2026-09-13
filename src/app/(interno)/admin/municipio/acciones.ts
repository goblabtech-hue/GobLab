'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { primerError } from '@/domain/validacion'
import { prisma } from '@/infrastructure/prisma'
import { storage, ImagenInvalida } from '@/infrastructure/almacenamiento'
import { guardarLogotipo } from '@/infrastructure/almacenamiento/logotipo'
import { requerirRol, NoAutorizado } from '@/infrastructure/auth'
import { invalidarConfiguracion } from '@/infrastructure/config'

export type Resultado = { ok?: boolean; error?: string }

/**
 * Números de emergencia válidos en México: el 911 nacional y los cortos que
 * todavía operan en algunos estados. Se valida en serio porque el bot le dice
 * a la gente «marca ahora a este número» en una emergencia: publicar uno
 * equivocado manda a alguien a un teléfono muerto en el peor momento posible.
 */
const CORTOS_EMERGENCIA = ['911', '066', '060', '089', '088']

const schema = z.object({
  nombre: z.string().trim().min(3, 'Escribe el nombre del municipio.').max(120),
  prefijoFolio: z.string().trim().toUpperCase()
    .regex(/^[A-ZÑ]{2,5}$/, 'El prefijo son de 2 a 5 letras, sin números ni espacios.'),
  telEmergencias: z.string().trim().refine(
    (v) => {
      const d = v.replace(/\D/g, '')
      return CORTOS_EMERGENCIA.includes(d) || d.length === 10
    },
    'Debe ser 911 (o el corto de tu estado) o un número a 10 dígitos.',
  ),
  centroLat: z.coerce.number().min(-90).max(90),
  centroLng: z.coerce.number().min(-180).max(180),
  zoomInicial: z.coerce.number().int().min(8, 'Mínimo 8.').max(18, 'Máximo 18.'),
  tema: z.enum(['demoscopia', 'institucional', 'federal', 'sobrio']),
})

export async function guardarMunicipio(
  _previo: Resultado, datos: FormData,
): Promise<Resultado> {
  try {
    const usuario = await requerirRol('admin')

    const parsed = schema.safeParse({
      nombre: datos.get('nombre'),
      prefijoFolio: datos.get('prefijoFolio'),
      telEmergencias: datos.get('telEmergencias'),
      centroLat: datos.get('centroLat'),
      centroLng: datos.get('centroLng'),
      zoomInicial: datos.get('zoomInicial'),
      tema: datos.get('tema') ?? 'demoscopia',
    })
    if (!parsed.success) return { error: primerError(parsed.error) }

    await prisma.configuracionMunicipio.upsert({
      where: { id: 1 },
      create: { id: 1, ...parsed.data, actualizadoPor: usuario.name ?? usuario.id },
      update: { ...parsed.data, actualizadoPor: usuario.name ?? usuario.id },
    })

    // Sin esto, el cambio tardaría hasta un minuto en verse por el caché.
    invalidarConfiguracion()

    // La identidad aparece en el encabezado de todo el sitio.
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    if (e instanceof NoAutorizado) return { error: 'Solo administración puede cambiar esto.' }
    throw e
  }
}

// ---------------------------------------------------------------- logotipo

export type ResultadoLogo = { ok?: true; error?: string }

/**
 * El escudo del municipio. Se procesa al subirlo —recorte, fondo
 * transparente, versión en blanco— y queda en el almacenamiento con las
 * demás imágenes. Cambia la cabecera de todo el sitio al instante.
 */
export async function subirLogotipo(_p: ResultadoLogo, datos: FormData): Promise<ResultadoLogo> {
  try {
    const usuario = await requerirRol('admin')
    const archivo = datos.get('logotipo')
    if (!(archivo instanceof File) || archivo.size === 0) return { error: 'Elige un archivo.' }

    const { color, blanco } = await guardarLogotipo(archivo)

    const anterior = await prisma.configuracionMunicipio.findUnique({
      where: { id: 1 }, select: { logoUrl: true, logoBlancoUrl: true },
    })
    await prisma.configuracionMunicipio.update({
      where: { id: 1 },
      data: { logoUrl: color, logoBlancoUrl: blanco, actualizadoPor: usuario.name ?? usuario.id },
    })
    // El anterior ya no se usa; se borra para no acumular archivos huérfanos.
    for (const url of [anterior?.logoUrl, anterior?.logoBlancoUrl]) {
      if (url) await storage().borrar(url).catch(() => {})
    }

    invalidarConfiguracion()
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    if (e instanceof NoAutorizado) return { error: 'Solo administración puede cambiar esto.' }
    if (e instanceof ImagenInvalida) return { error: e.message }
    throw e
  }
}

export async function quitarLogotipo(): Promise<ResultadoLogo> {
  try {
    const usuario = await requerirRol('admin')
    const actual = await prisma.configuracionMunicipio.findUnique({
      where: { id: 1 }, select: { logoUrl: true, logoBlancoUrl: true },
    })
    await prisma.configuracionMunicipio.update({
      where: { id: 1 },
      data: { logoUrl: null, logoBlancoUrl: null, actualizadoPor: usuario.name ?? usuario.id },
    })
    for (const url of [actual?.logoUrl, actual?.logoBlancoUrl]) {
      if (url) await storage().borrar(url).catch(() => {})
    }
    invalidarConfiguracion()
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    if (e instanceof NoAutorizado) return { error: 'Solo administración puede cambiar esto.' }
    throw e
  }
}
