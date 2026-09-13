import { prisma } from '@/infrastructure/prisma'
import { descifrarTelefono } from '@/domain/telefono'
import { fecha } from '@/domain/formato'
import { enviarCorreo } from '@/infrastructure/correo'
import { proveedor } from '@/infrastructure/mensajeria'

/**
 * Avisos al personal del municipio.
 *
 * El sistema ya le avisaba al ciudadano de cada cambio; al personal solo le
 * mandaba un correo genérico de alertas a una lista global. Pero quien tiene
 * que enterarse de que llegó un bache a su área es el titular de Obras
 * Públicas, y quien tiene que enterarse de que le asignaron ese bache es la
 * cuadrilla — cada uno por donde de verdad mira: el correo institucional del
 * área, y el Telegram o WhatsApp de la persona.
 *
 * Regla: cada quien recibe lo suyo, por todos los canales que tenga
 * conectados. Nunca lanza: un aviso que falla no puede deshacer la asignación
 * que lo disparó.
 */

export type EventoPersonal =
  | 'nuevo_en_area'   // llegó un reporte al área
  | 'asignado_a_ti'   // te tocó a ti
  | 'reabierto'       // el ciudadano dice que no quedó
  | 'vencido'         // se pasó la fecha límite sin resolver

type Destino = {
  nombre: string
  correo?: string | null
  telegramChatIdCifrado?: string | null
  telefonoCifrado?: string | null
}

type DatosReporte = {
  id: string
  folio: string
  descripcion: string
  fechaLimite: Date
  categoria: { nombre: string }
  colonia: { nombre: string } | null
  direccionTexto: string | null
  dependencia: { nombre: string }
}

async function cargarReporte(reporteId: string): Promise<DatosReporte | null> {
  return prisma.reporte.findUnique({
    where: { id: reporteId },
    select: {
      id: true, folio: true, descripcion: true, fechaLimite: true, direccionTexto: true,
      categoria: { select: { nombre: true } },
      colonia: { select: { nombre: true } },
      dependencia: { select: { nombre: true } },
    },
  })
}

const enlace = (folio: string) => {
  const base = process.env.SITIO_URL?.trim().replace(/\/$/, '')
  return base ? `${base}/bandeja/${folio}` : `/bandeja/${folio}`
}

function redactar(evento: EventoPersonal, r: DatosReporte): { asunto: string; texto: string } {
  const lugar = [r.direccionTexto, r.colonia ? `Col. ${r.colonia.nombre}` : null].filter(Boolean).join(' · ')
  const ficha = [
    `*${r.folio}* — ${r.categoria.nombre}`,
    lugar ? `📍 ${lugar}` : null,
    `📝 ${r.descripcion.length > 200 ? `${r.descripcion.slice(0, 200)}…` : r.descripcion}`,
    `⏱ Plazo: ${fecha(r.fechaLimite)}`,
    '',
    enlace(r.folio),
  ].filter((l) => l !== null).join('\n')

  switch (evento) {
    case 'nuevo_en_area':
      return {
        asunto: `Nuevo reporte para ${r.dependencia.nombre}: ${r.folio}`,
        texto: `Llegó un reporte a tu área.\n\n${ficha}`,
      }
    case 'asignado_a_ti':
      return {
        asunto: `Te asignaron el reporte ${r.folio}`,
        texto: `Te tocó este reporte.\n\n${ficha}`,
      }
    case 'reabierto':
      return {
        asunto: `El ciudadano reabrió el reporte ${r.folio}`,
        texto: `El ciudadano dice que el problema *sigue* después del trabajo. Hay que volver.\n\n${ficha}`,
      }
    case 'vencido':
      return {
        asunto: `Reporte vencido sin resolver: ${r.folio}`,
        texto: `Este reporte pasó su fecha límite y sigue abierto. El plazo se publica en el tablero ciudadano.\n\n${ficha}`,
      }
  }
}

/** Entrega a una persona o área por todos los canales que tenga. */
async function entregar(destino: Destino, aviso: { asunto: string; texto: string }): Promise<string[]> {
  const canales: string[] = []

  if (destino.correo) {
    if (await enviarCorreo({ para: destino.correo, asunto: aviso.asunto, texto: aviso.texto })) canales.push('correo')
  }
  if (destino.telegramChatIdCifrado) {
    try {
      await proveedor('telegram').enviar({ chatId: descifrarTelefono(destino.telegramChatIdCifrado), texto: aviso.texto })
      canales.push('telegram')
    } catch (e) { console.error(`[avisos] telegram a ${destino.nombre}:`, e) }
  }
  if (destino.telefonoCifrado) {
    try {
      await proveedor('whatsapp').enviar({ chatId: descifrarTelefono(destino.telefonoCifrado), texto: aviso.texto })
      canales.push('whatsapp')
    } catch (e) { console.error(`[avisos] whatsapp a ${destino.nombre}:`, e) }
  }
  return canales
}

async function bitacora(reporteId: string, evento: EventoPersonal, entregas: { a: string; canales: string[] }[]) {
  await prisma.eventoReporte.create({
    data: { reporteId, tipo: 'notificacion', detalle: { personal: evento, entregas } },
  }).catch(() => {})
}

/**
 * Al área: al correo institucional de la dependencia y a las personas que la
 * supervisan, por sus canales personales.
 */
export async function avisarArea(reporteId: string, evento: EventoPersonal): Promise<void> {
  try {
    const r = await cargarReporte(reporteId)
    if (!r) return
    const rep = await prisma.reporte.findUniqueOrThrow({ where: { id: reporteId }, select: { dependenciaId: true } })

    const [dep, supervisores] = await Promise.all([
      prisma.dependencia.findUnique({ where: { id: rep.dependenciaId }, select: { nombre: true, correo: true } }),
      prisma.usuario.findMany({
        where: { dependenciaId: rep.dependenciaId, activo: true, rol: 'supervisor' },
        select: { nombre: true, email: true, telegramChatIdCifrado: true, telefonoCifrado: true },
      }),
    ])
    const aviso = redactar(evento, r)
    const entregas: { a: string; canales: string[] }[] = []

    if (dep) {
      const canales = await entregar({ nombre: dep.nombre, correo: dep.correo }, aviso)
      if (canales.length) entregas.push({ a: dep.nombre, canales })
    }
    for (const s of supervisores) {
      // Su correo personal solo si es distinto del institucional: no se avisa
      // dos veces al mismo buzón.
      const canales = await entregar({
        nombre: s.nombre,
        correo: s.email !== dep?.correo ? s.email : null,
        telegramChatIdCifrado: s.telegramChatIdCifrado,
        telefonoCifrado: s.telefonoCifrado,
      }, aviso)
      if (canales.length) entregas.push({ a: s.nombre, canales })
    }
    await bitacora(reporteId, evento, entregas)
  } catch (e) {
    console.error('[avisos] área:', e)
  }
}

/** A una persona concreta: la cuadrilla a la que se asignó, normalmente. */
export async function avisarUsuario(reporteId: string, userId: string, evento: EventoPersonal): Promise<void> {
  try {
    const [r, u] = await Promise.all([
      cargarReporte(reporteId),
      prisma.usuario.findUnique({
        where: { id: userId },
        select: { nombre: true, email: true, telegramChatIdCifrado: true, telefonoCifrado: true, activo: true },
      }),
    ])
    if (!r || !u || !u.activo) return
    const canales = await entregar({
      nombre: u.nombre, correo: u.email,
      telegramChatIdCifrado: u.telegramChatIdCifrado, telefonoCifrado: u.telefonoCifrado,
    }, redactar(evento, r))
    await bitacora(reporteId, evento, canales.length ? [{ a: u.nombre, canales }] : [])
  } catch (e) {
    console.error('[avisos] usuario:', e)
  }
}

/**
 * Reportes que vencieron y de los que nadie ha sido avisado. Lo corre el cron
 * de alertas. Se avisa una sola vez por reporte: la bitácora lo recuerda.
 */
export async function avisarVencidos(ahora = new Date()): Promise<number> {
  const vencidos = await prisma.reporte.findMany({
    where: {
      estatus: { in: ['nuevo', 'asignado', 'en_atencion', 'reabierto'] },
      fechaLimite: { lt: ahora },
      eventos: { none: { tipo: 'notificacion', detalle: { path: ['personal'], equals: 'vencido' } } },
    },
    select: { id: true, asignadoAId: true },
    take: 100,
  })
  for (const r of vencidos) {
    await avisarArea(r.id, 'vencido')
    if (r.asignadoAId) await avisarUsuario(r.id, r.asignadoAId, 'vencido')
  }
  return vencidos.length
}
