'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { primerError } from '@/domain/validacion'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { prisma } from '@/infrastructure/prisma'
import {
  leerCatalogoSepomex, estadosDe, municipiosDe, importarMunicipioSepomex, ErrorSepomex,
  type FilaSepomex, type ResumenSepomex,
} from '@/application/sepomex'
import { cifrarTelefono, hashTelefono } from '@/domain/telefono'
import { nombreDelBot } from '@/infrastructure/mensajeria/telegram'
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
  /** WhatsApp del funcionario, para avisos. Diez dígitos; vacío lo quita. */
  telefono: z.string().trim().optional().nullable()
    .transform((t) => (t ? t.replace(/\D/g, '') : null))
    .refine((t) => t === null || t.length === 10, 'El teléfono son diez dígitos.'),
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
      telefono: datos.get('telefono') || null,
    })
    if (!parsed.success) return { error: primerError(parsed.error) }

    const { id, password, telefono, ...data } = parsed.data
    // El teléfono se guarda cifrado y hasheado, como el de los ciudadanos.
    // Vacío = no tocar el que haya: el formulario nunca lo muestra, así que
    // un campo vacío es lo normal al editar cualquier otra cosa de la cuenta.
    const canalTelefono = telefono
      ? { telefonoCifrado: cifrarTelefono(telefono), telefonoHash: hashTelefono(telefono) }
      : {}

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
        data: { ...data, ...canalTelefono, ...(password ? { hashPassword: await hashearPassword(password) } : {}) },
      })
    } else {
      if (!password) return { error: 'Escribe una contraseña para la cuenta nueva.' }
      await prisma.usuario.create({
        data: { ...data, ...canalTelefono, hashPassword: await hashearPassword(password) },
      })
    }
    revalidatePath('/admin/usuarios')
    return { ok: true }
  }) as Promise<Resultado>
}

// ---------------------------------------------------------------- Telegram del personal

const VIGENCIA_CODIGO_MIN = 15

/**
 * Código de un solo uso para que un funcionario vincule su Telegram.
 *
 * Se vincula con un código y no pidiéndole su usuario de Telegram porque el
 * bot no puede iniciar una conversación: Telegram solo deja escribirle a
 * quien le escribió primero. El código es la prueba de que la persona que
 * está del otro lado del chat es la misma que tiene la cuenta.
 */
export async function generarCodigoVinculacion(userId: string): Promise<{ codigo?: string; bot?: string; error?: string }> {
  return comoAdmin(async () => {
    const u = await prisma.usuario.findUnique({ where: { id: userId }, select: { activo: true } })
    if (!u?.activo) return { error: 'Esa cuenta no está activa.' }

    // Sin caracteres que se confundan entre sí (0/O, 1/I/L).
    const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    const codigo = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alfabeto[b % alfabeto.length]).join('')

    await prisma.usuario.update({
      where: { id: userId },
      data: { codigoVinculacion: codigo, codigoVinculacionExpira: new Date(Date.now() + VIGENCIA_CODIGO_MIN * 60_000) },
    })
    return { codigo, bot: await nombreDelBot() }
  }) as Promise<{ codigo?: string; bot?: string; error?: string }>
}

export async function desvincularTelegram(userId: string): Promise<Resultado> {
  return comoAdmin(async () => {
    await prisma.usuario.update({
      where: { id: userId },
      data: { telegramChatIdCifrado: null, telegramChatIdHash: null, codigoVinculacion: null, codigoVinculacionExpira: null },
    })
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

// ---------------------------------------------------------------- SEPOMEX

/**
 * El catálogo se sube UNA vez y se guarda ya leído en un archivo temporal con
 * un token; los pasos siguientes (elegir estado, elegir municipio, importar)
 * usan el token. Subir 25 MB tres veces para tres clics sería absurdo.
 */
const SEPOMEX_VIGENCIA_MS = 30 * 60_000

function rutaTemporalSepomex(token: string): string {
  if (!/^[a-f0-9]{32}$/.test(token)) throw new Error('Token inválido.')
  return path.join(os.tmpdir(), `sepomex-${token}.json`)
}

async function leerTemporalSepomex(token: string): Promise<FilaSepomex[]> {
  const ruta = rutaTemporalSepomex(token)
  const info = await fs.stat(ruta).catch(() => null)
  if (!info || Date.now() - info.mtimeMs > SEPOMEX_VIGENCIA_MS) {
    await fs.rm(ruta, { force: true }).catch(() => {})
    throw new ErrorSepomex('El archivo subido ya venció (30 minutos). Vuelve a subirlo.')
  }
  return JSON.parse(await fs.readFile(ruta, 'utf-8')) as FilaSepomex[]
}

export type ResultadoSubidaSepomex = { token?: string; estados?: string[]; total?: number; error?: string }

export async function subirCatalogoSepomex(datos: FormData): Promise<ResultadoSubidaSepomex> {
  return comoAdmin(async () => {
    const archivo = datos.get('archivo')
    if (!(archivo instanceof File) || archivo.size === 0) return { error: 'Elige el archivo del catálogo.' }
    if (archivo.size > 40 * 1024 * 1024) return { error: 'El archivo es demasiado grande (máximo 40 MB).' }
    try {
      const filas = leerCatalogoSepomex(new Uint8Array(await archivo.arrayBuffer()))
      const token = crypto.randomBytes(16).toString('hex')
      await fs.writeFile(rutaTemporalSepomex(token), JSON.stringify(filas), { mode: 0o600 })
      return { token, estados: estadosDe(filas), total: filas.length }
    } catch (e) {
      return { error: e instanceof ErrorSepomex ? e.message : 'No pude leer el archivo.' }
    }
  }) as Promise<ResultadoSubidaSepomex>
}

export async function municipiosSepomex(
  token: string, estado: string,
): Promise<{ municipios?: { nombre: string; asentamientos: number }[]; error?: string }> {
  return comoAdmin(async () => {
    try {
      return { municipios: municipiosDe(await leerTemporalSepomex(token), estado) }
    } catch (e) {
      return { error: e instanceof ErrorSepomex ? e.message : 'No pude leer el catálogo.' }
    }
  }) as Promise<{ municipios?: { nombre: string; asentamientos: number }[]; error?: string }>
}

export async function importarSepomex(
  token: string, municipio: string, estado: string,
): Promise<{ resumen?: ResumenSepomex; error?: string }> {
  return comoAdmin(async () => {
    try {
      const filas = await leerTemporalSepomex(token)
      const resumen = await importarMunicipioSepomex(filas, municipio, estado)
      await fs.rm(rutaTemporalSepomex(token), { force: true }).catch(() => {})
      revalidatePath('/admin/colonias')
      return { resumen }
    } catch (e) {
      return { error: e instanceof ErrorSepomex ? e.message : 'No pude importar el municipio.' }
    }
  }) as Promise<{ resumen?: ResumenSepomex; error?: string }>
}
