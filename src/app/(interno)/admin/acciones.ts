'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { primerError } from '@/domain/validacion'
import { prisma } from '@/infrastructure/prisma'
import { requerirRol, hashearPassword, NoAutorizado } from '@/infrastructure/auth'
import { invalidarCacheFestivos } from '@/infrastructure/festivos'
import {
  leerCatalogo, columna, ErrorImportacion, type ResultadoImportacion,
} from '@/application/importacion'

/**
 * Catálogos administrables (SPEC §3: el rol admin gestiona categorías,
 * colonias, dependencias, usuarios y promesas de servicio).
 *
 * Toda acción revalida su propia ruta y exige rol admin del lado servidor:
 * ocultar un botón en la UI no es control de acceso.
 */

export type Resultado = { ok?: boolean; error?: string }

async function comoAdmin<T>(fn: () => Promise<T>): Promise<T | Resultado> {
  try {
    await requerirRol('admin')
    return await fn()
  } catch (e) {
    if (e instanceof NoAutorizado) return { error: 'No tienes permiso para esta acción.' }
    throw e
  }
}

const texto = (min = 1, max = 200) => z.string().trim().min(min, 'Campo obligatorio.').max(max)

const slugify = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ---------------------------------------------------------------- categorías

const categoriaSchema = z.object({
  id: z.coerce.number().int().optional(),
  nombre: texto(3, 80),
  icono: texto(1, 40),
  descripcionCorta: z.string().trim().max(160).optional().or(z.literal('')),
  slaDiasHabiles: z.coerce.number().int().min(1, 'Mínimo 1 día.').max(60, 'Máximo 60 días.'),
  dependenciaId: z.coerce.number().int(),
  requiereEvidencia: z.coerce.boolean().optional(),
  activa: z.coerce.boolean().optional(),
})

export async function guardarCategoria(_p: Resultado, datos: FormData): Promise<Resultado> {
  return comoAdmin(async () => {
    const parsed = categoriaSchema.safeParse({
      id: datos.get('id') || undefined,
      nombre: datos.get('nombre'),
      icono: datos.get('icono'),
      descripcionCorta: datos.get('descripcionCorta'),
      slaDiasHabiles: datos.get('slaDiasHabiles'),
      dependenciaId: datos.get('dependenciaId'),
      requiereEvidencia: datos.get('requiereEvidencia') === 'on',
      activa: datos.get('activa') === 'on',
    })
    if (!parsed.success) return { error: primerError(parsed.error) }

    const { id, descripcionCorta, ...resto } = parsed.data
    const data = { ...resto, descripcionCorta: descripcionCorta || null }

    if (id) {
      await prisma.categoria.update({ where: { id }, data })
    } else {
      const base = slugify(data.nombre)
      // el slug es único: si ya existe, se numera
      let slug = base
      for (let i = 2; await prisma.categoria.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`
      const orden = (await prisma.categoria.count()) + 1
      await prisma.categoria.create({ data: { ...data, slug, orden } })
    }
    revalidatePath('/admin/categorias')
    return { ok: true }
  }) as Promise<Resultado>
}

// ---------------------------------------------------------------- dependencias

const dependenciaSchema = z.object({
  id: z.coerce.number().int().optional(),
  nombre: texto(3, 120),
  responsable: texto(3, 120),
  telefono: z.string().trim().regex(/^\d{7,15}$/, 'Escribe solo dígitos (7 a 15).'),
  correo: z.string().trim().toLowerCase().email('Escribe un correo válido.').optional().or(z.literal('')),
  activa: z.coerce.boolean().optional(),
})

export async function guardarDependencia(_p: Resultado, datos: FormData): Promise<Resultado> {
  return comoAdmin(async () => {
    const parsed = dependenciaSchema.safeParse({
      id: datos.get('id') || undefined,
      nombre: datos.get('nombre'),
      responsable: datos.get('responsable'),
      telefono: datos.get('telefono'),
      correo: datos.get('correo'),
      activa: datos.get('activa') === 'on',
    })
    if (!parsed.success) return { error: primerError(parsed.error) }

    const { id, correo, ...resto } = parsed.data
    const data = { ...resto, correo: correo || null }
    if (id) await prisma.dependencia.update({ where: { id }, data })
    else await prisma.dependencia.create({ data })
    revalidatePath('/admin/dependencias')
    return { ok: true }
  }) as Promise<Resultado>
}

// ---------------------------------------------------------------- colonias

const coloniaSchema = z.object({
  id: z.coerce.number().int().optional(),
  nombre: texto(2, 120),
  // Cinco dígitos: es lo que distingue dos asentamientos del mismo nombre en
  // puntos distintos del municipio.
  codigoPostal: z.string().trim().regex(/^\d{5}$/, 'El código postal son cinco dígitos.')
    .optional().nullable().or(z.literal('').transform(() => null)),
  tipo: z.string().trim().max(40).optional().nullable()
    .or(z.literal('').transform(() => null)),
  centroLat: z.coerce.number().min(-90).max(90).optional().nullable(),
  centroLng: z.coerce.number().min(-180).max(180).optional().nullable(),
})

export async function guardarColonia(_p: Resultado, datos: FormData): Promise<Resultado> {
  return comoAdmin(async () => {
    const crudo = {
      id: datos.get('id') || undefined,
      nombre: datos.get('nombre'),
      codigoPostal: datos.get('codigoPostal') || null,
      tipo: datos.get('tipo') || null,
      centroLat: datos.get('centroLat') || null,
      centroLng: datos.get('centroLng') || null,
    }
    const parsed = coloniaSchema.safeParse(crudo)
    if (!parsed.success) return { error: primerError(parsed.error) }

    const { id, ...data } = parsed.data
    if (id) {
      await prisma.colonia.update({ where: { id }, data })
    } else {
      const base = slugify(data.nombre)
      let slug = base
      for (let i = 2; await prisma.colonia.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`
      await prisma.colonia.create({ data: { ...data, slug } })
    }
    revalidatePath('/admin/colonias')
    return { ok: true }
  }) as Promise<Resultado>
}

// ---------------------------------------------------------------- festivos

const festivoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.'),
  nombre: texto(3, 120),
})

export async function agregarFestivo(_p: Resultado, datos: FormData): Promise<Resultado> {
  return comoAdmin(async () => {
    const parsed = festivoSchema.safeParse({
      fecha: datos.get('fecha'),
      nombre: datos.get('nombre'),
    })
    if (!parsed.success) return { error: primerError(parsed.error) }

    const fecha = new Date(`${parsed.data.fecha}T00:00:00Z`)
    const yaExiste = await prisma.diaFestivo.findUnique({ where: { fecha } })
    if (yaExiste) return { error: 'Ese día ya está registrado como festivo.' }

    await prisma.diaFestivo.create({ data: { fecha, nombre: parsed.data.nombre } })
    // el cálculo de días hábiles cachea los festivos: hay que tirar el caché
    invalidarCacheFestivos()
    revalidatePath('/admin/festivos')
    return { ok: true }
  }) as Promise<Resultado>
}

export async function borrarFestivo(datos: FormData): Promise<void> {
  await comoAdmin(async () => {
    const id = Number(datos.get('id'))
    if (Number.isInteger(id)) {
      await prisma.diaFestivo.delete({ where: { id } })
      invalidarCacheFestivos()
      revalidatePath('/admin/festivos')
    }
    return {}
  })
}

// ---------------------------------------------------------------- usuarios

const usuarioSchema = z.object({
  id: z.string().optional(),
  nombre: texto(3, 120),
  email: z.string().trim().toLowerCase().email('Escribe un correo válido.'),
  rol: z.enum(['operador', 'cuadrilla', 'supervisor', 'admin']),
  dependenciaId: z.coerce.number().int().optional().nullable(),
  activo: z.coerce.boolean().optional(),
  password: z.string().optional(),
})

export async function guardarUsuario(_p: Resultado, datos: FormData): Promise<Resultado> {
  return comoAdmin(async () => {
    const parsed = usuarioSchema.safeParse({
      id: datos.get('id') || undefined,
      nombre: datos.get('nombre'),
      email: datos.get('email'),
      rol: datos.get('rol'),
      dependenciaId: datos.get('dependenciaId') || null,
      activo: datos.get('activo') === 'on',
      password: datos.get('password') || undefined,
    })
    if (!parsed.success) return { error: primerError(parsed.error) }

    const { id, password, ...data } = parsed.data

    if (password && password.length < 8) {
      return { error: 'La contraseña debe tener al menos 8 caracteres.' }
    }

    const chocaEmail = await prisma.usuario.findFirst({
      where: { email: data.email, ...(id ? { id: { not: id } } : {}) },
      select: { id: true },
    })
    if (chocaEmail) return { error: 'Ya hay una cuenta con ese correo.' }

    if (id) {
      await prisma.usuario.update({
        where: { id },
        data: { ...data, ...(password ? { hashPassword: await hashearPassword(password) } : {}) },
      })
    } else {
      if (!password) return { error: 'Escribe una contraseña para la cuenta nueva.' }
      await prisma.usuario.create({
        data: { ...data, hashPassword: await hashearPassword(password) },
      })
    }
    revalidatePath('/admin/usuarios')
    return { ok: true }
  }) as Promise<Resultado>
}

// ---------------------------------------------------------------- importación

/**
 * Carga masiva de catálogos desde Excel o CSV.
 *
 * Se actualiza por nombre en vez de duplicar: volver a subir el mismo archivo
 * con una colonia corregida arregla esa y deja las demás intactas. Importar dos
 * veces no debe dejar el catálogo al doble.
 */
export type ResultadoImport = {
  ok?: boolean
  error?: string
  resumen?: ResultadoImportacion
}

export async function importarColonias(
  _p: ResultadoImport, datos: FormData,
): Promise<ResultadoImport> {
  return comoAdmin(async () => {
    const archivo = datos.get('archivo')
    if (!(archivo instanceof File)) return { error: 'Elige un archivo.' }

    let filas
    try {
      filas = await leerCatalogo(archivo)
    } catch (e) {
      return { error: e instanceof ErrorImportacion ? e.message : 'No pudimos leer el archivo.' }
    }

    const resumen: ResultadoImportacion = { creados: 0, actualizados: 0, omitidos: 0, errores: [] }

    for (const [i, fila] of filas.entries()) {
      const renglon = i + 2 // +1 por el encabezado, +1 porque Excel cuenta desde 1
      const nombre = columna(fila, 'nombre', 'colonia', 'nombredelacolonia', 'asentamiento')
      if (!nombre) { resumen.omitidos++; continue }
      if (nombre.length > 120) {
        resumen.errores.push(`Renglón ${renglon}: el nombre es demasiado largo.`)
        continue
      }

      const lat = Number(columna(fila, 'lat', 'latitud'))
      const lng = Number(columna(fila, 'lng', 'lon', 'long', 'longitud'))
      const coords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
        ? { centroLat: lat, centroLng: lng }
        : {}

      const cpCrudo = columna(fila, 'cp', 'codigopostal', 'codigo', 'c.p.', 'codigo_postal')
      const codigoPostal = /^\d{5}$/.test(cpCrudo) ? cpCrudo : null
      const tipo = columna(fila, 'tipo', 'tipoasentamiento', 'asentamientotipo') || null

      // Se busca por nombre Y código postal. Buscar solo por nombre parece
      // razonable hasta que el municipio tiene dos «El Cerrito» en puntos
      // distintos —Tula tiene tres—: una reimportación sobrescribiría la que
      // no era, y los reportes de esa colonia quedarían apuntando mal.
      const existente = await prisma.colonia.findFirst({
        where: {
          nombre: { equals: nombre, mode: 'insensitive' },
          ...(codigoPostal ? { codigoPostal } : {}),
        },
        select: { id: true },
      })

      if (existente) {
        await prisma.colonia.update({
          where: { id: existente.id },
          data: { nombre, ...(codigoPostal ? { codigoPostal } : {}), ...(tipo ? { tipo } : {}), ...coords },
        })
        resumen.actualizados++
      } else {
        const base = codigoPostal ? `${slugify(nombre)}-${codigoPostal}` : slugify(nombre)
        let slug = base
        for (let n = 2; await prisma.colonia.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`
        await prisma.colonia.create({ data: { nombre, slug, codigoPostal, tipo, ...coords } })
        resumen.creados++
      }
    }

    revalidatePath('/admin/colonias')
    return { ok: true, resumen }
  }) as Promise<ResultadoImport>
}

export async function importarDependencias(
  _p: ResultadoImport, datos: FormData,
): Promise<ResultadoImport> {
  return comoAdmin(async () => {
    const archivo = datos.get('archivo')
    if (!(archivo instanceof File)) return { error: 'Elige un archivo.' }

    let filas
    try {
      filas = await leerCatalogo(archivo)
    } catch (e) {
      return { error: e instanceof ErrorImportacion ? e.message : 'No pudimos leer el archivo.' }
    }

    const resumen: ResultadoImportacion = { creados: 0, actualizados: 0, omitidos: 0, errores: [] }

    for (const [i, fila] of filas.entries()) {
      const renglon = i + 2
      const nombre = columna(fila, 'nombre', 'dependencia', 'area', 'direccion')
      if (!nombre) { resumen.omitidos++; continue }

      const responsable = columna(fila, 'responsable', 'titular', 'encargado', 'nombredelresponsable')
      const telefono = columna(fila, 'telefono', 'tel', 'celular', 'numero').replace(/\D/g, '')
      const correo = columna(fila, 'correo', 'email', 'correoelectronico', 'mail').toLowerCase()

      if (!responsable) {
        resumen.errores.push(`Renglón ${renglon} (${nombre}): falta el responsable.`)
        continue
      }
      if (telefono && (telefono.length < 7 || telefono.length > 15)) {
        resumen.errores.push(`Renglón ${renglon} (${nombre}): el teléfono no parece válido.`)
        continue
      }
      if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        resumen.errores.push(`Renglón ${renglon} (${nombre}): el correo no parece válido.`)
        continue
      }

      const datosDep = {
        nombre, responsable,
        telefono: telefono || 'sin registrar',
        correo: correo || null,
      }

      const existente = await prisma.dependencia.findFirst({
        where: { nombre: { equals: nombre, mode: 'insensitive' } },
        select: { id: true },
      })

      if (existente) {
        await prisma.dependencia.update({ where: { id: existente.id }, data: datosDep })
        resumen.actualizados++
      } else {
        await prisma.dependencia.create({ data: datosDep })
        resumen.creados++
      }
    }

    revalidatePath('/admin/dependencias')
    return { ok: true, resumen }
  }) as Promise<ResultadoImport>
}
