import { prisma } from '@/infrastructure/prisma'

/**
 * Aviso de privacidad con historial de versiones.
 *
 * Versionar no es un lujo: la gente aceptó una redacción concreta el día que
 * levantó su reporte. Sustituirla sin dejar rastro borra la constancia de qué
 * se le informó, que es justo lo que un aviso de privacidad existe para
 * documentar.
 */

export class ErrorAviso extends Error {}

export type AvisoResumen = {
  id: number
  version: number
  titulo: string
  publicado: boolean
  notaCambio: string | null
  actualizadoPor: string | null
  createdAt: Date
}

/** El aviso que ve el ciudadano. Null si todavía no se publica ninguno. */
export async function avisoPublicado() {
  return prisma.avisoPrivacidad.findFirst({
    where: { publicado: true },
    orderBy: { version: 'desc' },
  })
}

export async function historial(): Promise<AvisoResumen[]> {
  return prisma.avisoPrivacidad.findMany({
    orderBy: { version: 'desc' },
    select: {
      id: true, version: true, titulo: true, publicado: true,
      notaCambio: true, actualizadoPor: true, createdAt: true,
    },
  })
}

export async function obtenerVersion(version: number) {
  return prisma.avisoPrivacidad.findUnique({ where: { version } })
}

export type NuevaVersion = {
  titulo: string
  contenido: string
  notaCambio?: string
  autor: string
  publicar: boolean
}

/**
 * Guarda una versión nueva. Nunca sobrescribe: cada guardado crea una versión,
 * y publicar despublica la anterior.
 */
export async function guardarVersion(datos: NuevaVersion) {
  const titulo = datos.titulo.trim()
  // El navegador manda los saltos de línea de un textarea como CRLF. Sin
  // normalizar, cada guardado por formulario engorda el documento y el
  // historial muestra diferencias que nadie escribió.
  const contenido = datos.contenido.replace(/\r\n/g, '\n').trim()

  if (titulo.length < 5) throw new ErrorAviso('El título es demasiado corto.')
  if (contenido.length < 200) {
    throw new ErrorAviso(
      'El texto es demasiado corto para ser un aviso de privacidad. ' +
      'Revisa que se haya pegado completo.',
    )
  }

  const ultima = await prisma.avisoPrivacidad.findFirst({
    orderBy: { version: 'desc' }, select: { version: true },
  })
  const version = (ultima?.version ?? 0) + 1

  return prisma.$transaction(async (tx) => {
    if (datos.publicar) {
      await tx.avisoPrivacidad.updateMany({
        where: { publicado: true }, data: { publicado: false },
      })
    }
    return tx.avisoPrivacidad.create({
      data: {
        version, titulo, contenido,
        publicado: datos.publicar,
        notaCambio: datos.notaCambio?.trim() || null,
        actualizadoPor: datos.autor,
      },
    })
  })
}

/** Pone en vigor una versión ya guardada. */
export async function publicarVersion(version: number) {
  const aviso = await prisma.avisoPrivacidad.findUnique({ where: { version } })
  if (!aviso) throw new ErrorAviso('Esa versión no existe.')

  await prisma.$transaction([
    prisma.avisoPrivacidad.updateMany({ where: { publicado: true }, data: { publicado: false } }),
    prisma.avisoPrivacidad.update({ where: { version }, data: { publicado: true } }),
  ])
}
