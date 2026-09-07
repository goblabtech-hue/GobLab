import { prisma } from '@/infrastructure/prisma'
import { puedeTransicionar } from '@/domain/estatus'
import { notificarCiudadano } from '@/application/notificaciones'
import { ReglaDeNegocio, registrarEvento } from './nucleo'

/**
 * Triaje: a quién le toca cada reporte (SPEC §4.2).
 */

// ---------------------------------------------------------------- triaje

export async function asignarCuadrilla(reporteId: string, cuadrillaId: string, userId: string) {
  const r = await prisma.reporte.findUnique({
    where: { id: reporteId }, select: { estatus: true, asignadoAId: true },
  })
  if (!r) throw new ReglaDeNegocio('Reporte no encontrado.')
  if (r.estatus !== 'nuevo' && !puedeTransicionar(r.estatus, 'asignado')) {
    throw new ReglaDeNegocio('Ese reporte ya no admite asignación.')
  }

  const cuadrilla = await prisma.usuario.findUnique({
    where: { id: cuadrillaId }, select: { id: true, nombre: true, activo: true },
  })
  if (!cuadrilla?.activo) throw new ReglaDeNegocio('Esa cuenta no está activa.')

  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: reporteId },
      data: { asignadoAId: cuadrillaId, estatus: r.estatus === 'nuevo' ? 'asignado' : r.estatus },
    })
    await registrarEvento(tx, { reporteId: reporteId, tipo: 'asignado', detalle: { cuadrillaId, cuadrilla: cuadrilla.nombre }, userId: userId })
  })

  await notificarCiudadano(reporteId, 'asignado')
}

/**
 * Reasigna a otra dependencia. El motivo es obligatorio porque cada
 * reasignación alimenta el KPI de mal ruteo (SPEC §4.2 y §6.5): sin motivo, el
 * indicador dice que algo se rutea mal pero no por qué.
 */
export type DatosReasignacion = {
  reporteId: string
  dependenciaId: number
  motivo: string
  userId: string
}

export async function reasignarDependencia(datos: DatosReasignacion) {
  const { reporteId, dependenciaId, motivo, userId } = datos
  const limpio = motivo.trim()
  if (limpio.length < 10) {
    throw new ReglaDeNegocio('Explica en al menos 10 caracteres por qué se reasigna.')
  }

  const r = await prisma.reporte.findUnique({
    where: { id: reporteId }, select: { estatus: true, dependenciaId: true },
  })
  if (!r) throw new ReglaDeNegocio('Reporte no encontrado.')
  if (['cerrado', 'duplicado', 'improcedente'].includes(r.estatus)) {
    throw new ReglaDeNegocio('Un reporte cerrado ya no se reasigna.')
  }
  if (r.dependenciaId === dependenciaId) {
    throw new ReglaDeNegocio('El reporte ya está en esa dependencia.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: reporteId },
      // cambiar de dependencia invalida la cuadrilla anterior
      data: { dependenciaId, asignadoAId: null },
    })
    await registrarEvento(tx, { reporteId: reporteId, tipo: 'reasignado', detalle: {
      de: r.dependenciaId, a: dependenciaId, motivo: limpio,
    }, userId: userId })
  })
}

export async function marcarImprocedente(reporteId: string, motivo: string, userId: string) {
  const limpio = motivo.trim()
  if (limpio.length < 15) {
    throw new ReglaDeNegocio('El motivo se le muestra al ciudadano: explícalo en al menos 15 caracteres.')
  }
  const r = await prisma.reporte.findUnique({ where: { id: reporteId }, select: { estatus: true } })
  if (!r) throw new ReglaDeNegocio('Reporte no encontrado.')
  if (!puedeTransicionar(r.estatus, 'improcedente')) {
    throw new ReglaDeNegocio('Ese reporte ya no se puede marcar como improcedente.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({
      where: { id: reporteId },
      data: { estatus: 'improcedente', motivoImprocedente: limpio },
    })
    await registrarEvento(tx, { reporteId: reporteId, tipo: 'improcedente', detalle: { motivo: limpio }, userId: userId })
  })

  await notificarCiudadano(reporteId, 'improcedente')
}

export async function iniciarAtencion(reporteId: string, userId: string) {
  const r = await prisma.reporte.findUnique({ where: { id: reporteId }, select: { estatus: true } })
  if (!r) throw new ReglaDeNegocio('Reporte no encontrado.')
  if (r.estatus === 'en_atencion') return
  if (!puedeTransicionar(r.estatus, 'en_atencion')) {
    throw new ReglaDeNegocio('Ese reporte no se puede poner en atención.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.reporte.update({ where: { id: reporteId }, data: { estatus: 'en_atencion' } })
    await registrarEvento(tx, { reporteId: reporteId, tipo: 'en_atencion', userId: userId })
  })
}
