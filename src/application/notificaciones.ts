import { prisma } from '@/infrastructure/prisma'
import type { CanalMensajeria } from '@/generated/prisma/enums'
import { obtenerConfiguracion } from '@/infrastructure/config'
import { descifrarTelefono } from '@/domain/telefono'
import { fecha } from '@/domain/formato'
import { proveedor } from '@/infrastructure/mensajeria'
import { hashTelefono } from '@/domain/telefono'
import { pushAFolio } from '@/infrastructure/push'

/**
 * Avisos al ciudadano en cada cambio relevante (SPEC §4.1).
 *
 * Nunca lanzan: un fallo del proveedor de mensajería no puede tumbar la
 * transición de estatus que las disparó. Si el envío falla se registra en la
 * bitácora del reporte con el motivo, para que se pueda revisar después.
 *
 * El destino sale de `canalNotificacion` + `destinoNotificacion`, no del
 * teléfono: un reporte levantado por Telegram puede no tener número, y aun así
 * hay que poder avisarle a esa persona.
 */

export type TipoAviso = 'asignado' | 'en_atencion' | 'resuelto' | 'cerrado' | 'reabierto' | 'improcedente'

export async function notificarCiudadano(reporteId: string, tipo: TipoAviso): Promise<void> {
  try {
    const r = await prisma.reporte.findUnique({
      where: { id: reporteId },
      select: {
        folio: true, canalNotificacion: true, destinoNotificacion: true,
        telefonoCifrado: true,
        fechaLimite: true, resueltoAt: true, motivoImprocedente: true, notaCierre: true,
        categoria: { select: { nombre: true } },
        // La foto del trabajo terminado: es la diferencia entre «dice que lo
        // arregló» y «lo arregló». Se manda la más reciente.
        fotos: {
          where: { tipo: 'evidencia' },
          orderBy: { createdAt: 'desc' }, take: 1,
          select: { url: true },
        },
      },
    })
    if (!r) return

    // Un reporte levantado por la web o por ventanilla no trae canal, pero sí
    // puede traer teléfono — y en México ese número es su WhatsApp. Sin esto,
    // quien reporta por la web nunca se enteraría de que ya se resolvió, que
    // es justo lo que el SPEC §4.1 pide evitar.
    const canal = r.canalNotificacion ?? (r.telefonoCifrado ? 'whatsapp' : null)
    const destino = r.destinoNotificacion ?? r.telefonoCifrado
    if (!canal || !destino) return // de verdad no hay a dónde avisar

    const cfg = await obtenerConfiguracion()
    const texto = redactar(tipo, {
      folio: r.folio,
      categoria: r.categoria.nombre,
      fechaLimite: r.fechaLimite,
      motivoImprocedente: r.motivoImprocedente,
      notaCierre: r.notaCierre,
    }, cfg.telEmergencias)
    if (!texto) return

    const chatId = descifrarTelefono(destino)
    const evidencia = tipo === 'resuelto' ? r.fotos[0]?.url : undefined

    await proveedor(canal).enviar({
      chatId,
      texto,
      ...(evidencia ? { mediaUrl: evidencia } : {}),
      ...(tipo === 'resuelto'
        ? {
            botones: [
              { id: 'quedo_si', texto: '✅ Sí, quedó' },
              { id: 'quedo_no', texto: '❌ No, sigue igual' },
            ],
          }
        : {}),
    })

    // La app de las tiendas: a los teléfonos que siguen este folio también les
    // llega un push, además del canal por el que reportaron. Es un canal más,
    // no el único; sin credenciales de FCM simplemente no manda.
    const titulos: Record<TipoAviso, string> = {
      asignado: 'Tu reporte ya tiene cuadrilla', en_atencion: 'Ya están trabajando en tu reporte',
      resuelto: '¿Quedó resuelto?', cerrado: 'Reporte cerrado', reabierto: 'Tu reporte se reabrió',
      improcedente: 'Sobre tu reporte',
    }
    const enviadosPush = await pushAFolio(r.folio, titulos[tipo], texto.replace(/\*/g, '').split('\n')[0] ?? '', `/folio/${r.folio}`)
      .catch((e) => { console.error('[push]', e); return 0 })
    if (enviadosPush > 0) {
      await prisma.eventoReporte.create({
        data: { reporteId, tipo: 'notificacion', detalle: { tipo, canal: 'push', dispositivos: enviadosPush } },
      }).catch(() => {})
    }

    // Y se deja la conversación esperando esa respuesta. Sin esto el sistema
    // preguntaba «¿quedó bien?» y no había nada escuchando: la persona
    // contestaba al vacío y a los tres días el reporte se autocerraba solo.
    if (tipo === 'resuelto') await esperarConfirmacion(reporteId, canal, chatId)

    await prisma.eventoReporte.create({
      data: { reporteId, tipo: 'notificacion', detalle: { tipo, canal, entregado: true } },
    })
  } catch (e) {
    const motivo = e instanceof Error ? e.message : 'error desconocido'
    await prisma.eventoReporte.create({
      data: { reporteId, tipo: 'notificacion', detalle: { tipo, entregado: false, error: motivo } },
    }).catch(() => {})
    console.error(`[notificaciones] ${reporteId} (${tipo}):`, motivo)
  }
}

function redactar(
  tipo: TipoAviso,
  r: {
    folio: string
    categoria: string
    fechaLimite: Date
    motivoImprocedente: string | null
    notaCierre: string | null
  },
  telEmergencias: string,
): string | null {
  const encabezado = `Reporte *${r.folio}* — ${r.categoria}`

  switch (tipo) {
    case 'asignado':
      return `${encabezado}\n\nYa tiene cuadrilla asignada. Seguimos con el compromiso de atenderlo a más tardar el ${fecha(r.fechaLimite)}.`

    case 'en_atencion':
      return `${encabezado}\n\nLa cuadrilla ya está trabajando en él.`

    case 'resuelto':
      // Se pregunta si quedó, no se pide una calificación a secas: quien
      // decide si el problema se resolvió es quien lo vive, y esa respuesta
      // es la que cierra el reporte.
      return `${encabezado}\n\n✅ La cuadrilla terminó el trabajo. Aquí está cómo quedó.${r.notaCierre ? `\n\n«${r.notaCierre}»` : ''}\n\n*¿Quedó resuelto tu problema?* Tu respuesta es la que cierra el reporte.`

    case 'cerrado':
      return `${encabezado}\n\nEste reporte quedó cerrado. Gracias por ayudarnos a mejorar tu colonia.`

    case 'reabierto':
      return `${encabezado}\n\nLo reabrimos porque nos dijiste que el problema sigue. La cuadrilla lo va a revisar otra vez; el nuevo plazo vence el ${fecha(r.fechaLimite)}.`

    case 'improcedente':
      return `${encabezado}\n\nEste caso no lo puede atender el municipio.\n\n${r.motivoImprocedente ?? ''}\n\nSi crees que es un error, escribe *menú* y pide hablar con una persona. Para emergencias, marca al ${telEmergencias}.`

    default:
      return null
  }
}

/**
 * Deja la conversación de esa persona esperando su veredicto sobre el trabajo.
 *
 * Vive aquí y no en el bot porque quien resuelve es el personal municipal
 * desde la bandeja, no el ciudadano desde el chat: el aviso es lo único que
 * conecta las dos mitades. Si no hay conversación abierta —reportó por la web
 * o por ventanilla— no se hace nada: al escribirle al bot con su folio verá
 * las mismas opciones.
 */
async function esperarConfirmacion(
  reporteId: string, canal: CanalMensajeria, chatId: string,
): Promise<void> {
  try {
    const reporte = await prisma.reporte.findUnique({
      where: { id: reporteId }, select: { folio: true },
    })
    if (!reporte) return

    const conv = await prisma.conversacionBot.findFirst({
      where: { canal, chatIdHash: hashTelefono(chatId) },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, escaladaAHumano: true },
    })
    // Si está hablando con una persona del municipio, no se le interrumpe.
    if (!conv || conv.escaladaAHumano) return

    await prisma.conversacionBot.update({
      where: { id: conv.id },
      data: {
        estado: {
          paso: 'confirmando_resolucion', reporteId, folio: reporte.folio,
        } as never,
      },
    })
  } catch (e) {
    // Que falle esto no puede tumbar el aviso, que es lo importante.
    console.error('[notificaciones] no se pudo dejar la conversación esperando:', e)
  }
}
