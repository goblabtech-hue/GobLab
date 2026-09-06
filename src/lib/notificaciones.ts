import { prisma } from '@/lib/prisma'
import { obtenerConfiguracion } from '@/lib/config'
import { descifrarTelefono } from '@/lib/telefono'
import { fecha } from '@/lib/utils'
import { proveedor } from '@/lib/mensajeria'

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
    await proveedor(canal).enviar({ chatId, texto })

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
      return `${encabezado}\n\n✅ Terminamos el trabajo.${r.notaCierre ? `\n\n${r.notaCierre}` : ''}\n\n¿Cómo quedó? Responde con un número del 1 al 5, donde 5 es excelente. Tu calificación es la forma en que sabemos si de verdad resolvimos tu problema.`

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
