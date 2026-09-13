import nodemailer from 'nodemailer'
import { obtenerConfiguracion } from '@/infrastructure/config'
import type { AlertaEvaluada } from '@/application/alertas'

/**
 * Correo saliente.
 *
 * Solo funciona si el municipio configuró un SMTP. Sin configuración no falla
 * ni bloquea nada: se registra en el log y lo que disparó el correo sigue su
 * curso. Un aviso que tumba la asignación de un reporte porque el servidor de
 * correo no responde es peor que no tener correo.
 */

export type Correo = {
  para: string | string[]
  asunto: string
  texto: string
}

/**
 * Buzón de prueba. Con SMTP_HOST="buzon-prueba" nada sale de la máquina: los
 * correos se guardan aquí para que las pruebas puedan afirmar a quién y qué
 * se habría mandado. Es un valor imposible como host real, así que no hay
 * forma de dejarlo puesto en producción por accidente y no notarlo.
 */
export const buzonDePrueba: Correo[] = []

export function correoConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM)
}

export async function enviarCorreo(correo: Correo): Promise<boolean> {
  const destinatarios = Array.isArray(correo.para) ? correo.para : [correo.para]
  const validos = destinatarios.filter((d) => d && d.includes('@'))
  if (validos.length === 0) return false

  if (process.env.SMTP_HOST === 'buzon-prueba') {
    buzonDePrueba.push({ ...correo, para: validos })
    return true
  }

  if (!correoConfigurado()) {
    console.warn(`[correo] sin enviar (falta SMTP): «${correo.asunto}» → ${validos.join(', ')}`)
    return false
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
    const cfg = await obtenerConfiguracion()
    await transporte.sendMail({
      from: process.env.SMTP_FROM,
      to: validos.join(', '),
      subject: `[${cfg.nombre}] ${correo.asunto}`,
      text: `${correo.texto}\n\n—\nEste correo lo manda el sistema de atención ciudadana automáticamente. No respondas a esta dirección.`,
    })
    return true
  } catch (e) {
    // Nunca propaga: el correo es el aviso, no el hecho.
    console.error('[correo] no se pudo enviar:', e)
    return false
  }
}

/** Alertas globales del SPEC §4.5, a la lista de administración. */
export async function enviarCorreoAlerta(alertas: AlertaEvaluada[]): Promise<void> {
  if (alertas.length === 0) return
  const para = process.env.ALERTAS_DESTINATARIOS
  if (!para) {
    console.warn(`[alertas] ${alertas.length} alerta(s) sin correo: falta ALERTAS_DESTINATARIOS.`)
    return
  }
  const lista = alertas.map((a) => `• ${a.mensaje}`).join('\n')
  await enviarCorreo({
    para: para.split(',').map((s) => s.trim()),
    asunto: alertas.length === 1 ? 'Alerta de atención ciudadana' : `${alertas.length} alertas de atención ciudadana`,
    texto: `El sistema detectó lo siguiente:\n\n${lista}\n\nRevisa el detalle en el tablero interno, sección Indicadores.`,
  })
}
