import nodemailer from 'nodemailer'
import { municipio } from '@/lib/config'
import type { AlertaEvaluada } from '@/lib/alertas'

/**
 * Correo de alertas (SPEC §4.5: «banner + correo»).
 *
 * El banner del tablero interno funciona siempre; el correo solo si el
 * municipio configuró un SMTP. Sin configuración no falla ni bloquea nada: se
 * registra en el log y la alerta igual queda guardada y visible. Un sistema de
 * alertas que se cae porque el servidor de correo no responde es peor que no
 * tener correo.
 */

function configurado(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && process.env.ALERTAS_DESTINATARIOS)
}

export async function enviarCorreoAlerta(alertas: AlertaEvaluada[]): Promise<void> {
  if (alertas.length === 0) return

  if (!configurado()) {
    console.warn(
      `[alertas] ${alertas.length} alerta(s) sin enviar por correo: falta configurar SMTP. ` +
      alertas.map((a) => a.mensaje).join(' | '),
    )
    return
  }

  try {
    const transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SEGURO === 'true',
      auth: process.env.SMTP_USUARIO
        ? { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })

    const lista = alertas.map((a) => `• ${a.mensaje}`).join('\n')

    await transporte.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.ALERTAS_DESTINATARIOS,
      subject: `[${municipio.nombre}] ${alertas.length === 1 ? 'Alerta' : `${alertas.length} alertas`} de atención ciudadana`,
      text: `El sistema detectó lo siguiente:\n\n${lista}\n\nRevisa el detalle en el tablero interno, sección Indicadores.\n\nEste correo lo manda el sistema automáticamente. No respondas a esta dirección.`,
    })
  } catch (e) {
    // Nunca propaga: el correo es el aviso, no la alerta.
    console.error('[alertas] no se pudo enviar el correo:', e)
  }
}
