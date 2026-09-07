import { NextResponse } from 'next/server'
import crypto from 'node:crypto'

/**
 * Autenticación de las tareas programadas (corrección C-07).
 *
 * El SPEC exige autocierre a los 3 días y agregados refrescados cada 15 min,
 * pero no define quién los dispara. Se exponen como endpoints protegidos con
 * un secreto, invocables desde Vercel Cron o desde el crontab del servidor.
 * Ver README para las líneas de crontab.
 */
export function autorizadoComoCron(request: Request): boolean {
  const esperado = process.env.CRON_SECRET
  if (!esperado) return false

  const recibido = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const a = Buffer.from(recibido)
  const b = Buffer.from(esperado)
  // Comparación de tiempo constante: una comparación normal filtra el secreto
  // carácter por carácter a quien mida los tiempos de respuesta.
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export const noAutorizado = () =>
  NextResponse.json({ error: 'No autorizado' }, { status: 401 })
