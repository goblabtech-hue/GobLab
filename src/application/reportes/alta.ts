import { prisma } from '@/infrastructure/prisma'
import { avisarArea } from '@/application/avisos-personal'
import { generarFolio } from '@/infrastructure/folio'
import { cargarFestivos } from '@/infrastructure/festivos'
import { calcularFechaLimite } from '@/domain/dias-habiles'
import { derivarTelefono } from '@/domain/telefono'
import { prioridadPorAdhesiones } from '@/domain/distancia'
import { puedeTransicionar } from '@/domain/estatus'
import { buscarDuplicados } from '@/application/duplicados'
import { ReglaDeNegocio, registrarEvento } from './nucleo'
import type { OrigenReporte, Prioridad } from '@/generated/prisma/enums'

/**
 * Alta de reportes y adhesiones (SPEC §4.1 y §4.2).
 */

// ---------------------------------------------------------------- alta

export type DatosNuevoReporte = {
  categoriaId: number
  descripcion: string
  origen: OrigenReporte
  lat?: number | null
  lng?: number | null
  direccionTexto?: string | null
  coloniaId?: number | null
  telefono?: string | null
  nombreContacto?: string | null
  prioridad?: Prioridad
  fotos?: string[]
  /** Id del operador que captura, cuando el origen es teléfono o ventanilla. */
  capturadoPorId?: string | null
}

export type ReporteCreado = {
  id: string
  folio: string
  fechaLimite: Date
  slaDiasHabiles: number
  categoriaNombre: string
}

/**
 * Crea un reporte con folio, fecha límite y dependencia responsable.
 *
 * DECISIÓN D-09: el reporte nace en `nuevo` con la dependencia ya definida por
 * la categoría (SPEC §4.2: "el reporte nace asignado"); pasa a `asignado`
 * cuando se le asigna una cuadrilla concreta. Así `nuevo` significa algo
 * accionable en la bandeja —"falta ponerle cuadrilla"— en vez de ser un estado
 * que nadie usa.
 */
export async function crearReporte(datos: DatosNuevoReporte): Promise<ReporteCreado> {
  const categoria = await prisma.categoria.findUnique({
    where: { id: datos.categoriaId },
    select: { id: true, nombre: true, slaDiasHabiles: true, dependenciaId: true, activa: true },
  })
  if (!categoria) throw new ReglaDeNegocio('Esa categoría no existe.')
  if (!categoria.activa) throw new ReglaDeNegocio('Esa categoría ya no está disponible.')

  const festivos = await cargarFestivos()
  const creado = new Date()
  const fechaLimite = calcularFechaLimite(creado, categoria.slaDiasHabiles, festivos)
  const tel = datos.telefono ? derivarTelefono(datos.telefono) : null

  const reporte = await prisma.$transaction(async (tx) => {
    const folio = await generarFolio(tx, creado)

    const r = await tx.reporte.create({
      data: {
        folio,
        categoriaId: categoria.id,
        descripcion: datos.descripcion.trim(),
        origen: datos.origen,
        prioridad: datos.prioridad ?? 'normal',
        estatus: 'nuevo',
        lat: datos.lat ?? null,
        lng: datos.lng ?? null,
        direccionTexto: datos.direccionTexto?.trim() || null,
        coloniaId: datos.coloniaId ?? null,
        telefonoHash: tel?.telefonoHash ?? null,
        telefonoCifrado: tel?.telefonoCifrado ?? null,
        telefonoMascara: tel?.telefonoMascara ?? null,
        nombreContacto: datos.nombreContacto?.trim() || null,
        dependenciaId: categoria.dependenciaId,
        fechaLimite,
        // Copia del plazo vigente al momento del alta: si mañana cambia, este
        // reporte se sigue midiendo contra lo que se le prometió.
        slaDiasHabilesAplicado: categoria.slaDiasHabiles,
        createdAt: creado,
      },
      select: { id: true, folio: true, fechaLimite: true },
    })

    if (datos.fotos?.length) {
      await tx.fotoReporte.createMany({
        data: datos.fotos.map((url) => ({ reporteId: r.id, url, tipo: 'ciudadano' as const })),
      })
    }

    await registrarEvento(tx, { reporteId: r.id, tipo: 'creado', detalle: {
      origen: datos.origen,
      dependenciaId: categoria.dependenciaId,
      fotos: datos.fotos?.length ?? 0,
    }, userId: datos.capturadoPorId })

    return r
  })

  // El área se entera de que le llegó trabajo. Fuera de la transacción: un
  // aviso que falla no puede deshacer el alta.
  await avisarArea(reporte.id, 'nuevo_en_area')

  return {
    ...reporte,
    slaDiasHabiles: categoria.slaDiasHabiles,
    categoriaNombre: categoria.nombre,
  }
}

// ---------------------------------------------------------------- duplicados

/** Candidatos a duplicado para un reporte que aún no se crea (SPEC §4.2). */
export async function posiblesDuplicados(categoriaId: number, lat?: number | null, lng?: number | null) {
  return buscarDuplicados({ categoriaId, lat: lat ?? null, lng: lng ?? null })
}

/**
 * Suma un teléfono a las notificaciones de un reporte existente en vez de
 * abrir uno nuevo. Las adhesiones suben la prioridad (SPEC §4.2).
 */
export async function adherirse(reporteId: string, telefono: string) {
  const tel = derivarTelefono(telefono)

  const reporte = await prisma.reporte.findUnique({
    where: { id: reporteId },
    select: { id: true, folio: true, estatus: true, prioridad: true, telefonoHash: true },
  })
  if (!reporte) throw new ReglaDeNegocio('Ese reporte no existe.')
  if (!['nuevo', 'asignado', 'en_atencion', 'reabierto'].includes(reporte.estatus)) {
    throw new ReglaDeNegocio('Ese reporte ya está cerrado; conviene levantar uno nuevo.')
  }
  if (reporte.telefonoHash === tel.telefonoHash) {
    throw new ReglaDeNegocio('Este reporte ya es tuyo: puedes seguirlo con su folio.')
  }

  await prisma.adhesion.upsert({
    where: { reporteId_telefonoHash: { reporteId, telefonoHash: tel.telefonoHash } },
    create: { reporteId, ...tel },
    update: {},
  })

  const total = await prisma.adhesion.count({ where: { reporteId } })
  const nueva = prioridadPorAdhesiones(total)

  await prisma.$transaction(async (tx) => {
    if (nueva !== reporte.prioridad) {
      await tx.reporte.update({ where: { id: reporteId }, data: { prioridad: nueva } })
    }
    await registrarEvento(tx, { reporteId: reporteId, tipo: 'adhesion', detalle: { adhesiones: total, prioridad: nueva } })
  })

  return { folio: reporte.folio, adhesiones: total, prioridad: nueva }
}

/** Marca un reporte como duplicado de otro y liga al ciudadano al original. */
export async function marcarDuplicado(reporteId: string, originalId: string, userId: string) {
  if (reporteId === originalId) throw new ReglaDeNegocio('Un reporte no puede ser duplicado de sí mismo.')

  const [r, original] = await Promise.all([
    prisma.reporte.findUnique({ where: { id: reporteId }, select: { estatus: true, telefonoCifrado: true } }),
    prisma.reporte.findUnique({ where: { id: originalId }, select: { id: true, folio: true } }),
  ])
  if (!r || !original) throw new ReglaDeNegocio('Reporte no encontrado.')
  if (!puedeTransicionar(r.estatus, 'duplicado')) {
    throw new ReglaDeNegocio('Ese reporte ya no se puede marcar como duplicado.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: reporteId },
      data: { estatus: 'duplicado', reporteOriginalId: originalId },
    })
    await registrarEvento(tx, { reporteId: reporteId, tipo: 'duplicado', detalle: { originalId, folioOriginal: original.folio }, userId: userId })
  })
}
