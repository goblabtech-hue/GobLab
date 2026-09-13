import crypto from 'node:crypto'
import { prisma } from '@/infrastructure/prisma'

/**
 * Notificaciones push a la app (iOS y Android), por Firebase Cloud Messaging.
 *
 * Se usa FCM para las dos plataformas: Firebase reenvía a APNs en iOS, así
 * que basta una credencial. Es la API v1, que pide un token OAuth firmado con
 * la cuenta de servicio; se firma aquí con `node:crypto` para no cargar una
 * librería por una sola llamada.
 *
 * Sin `FCM_SERVICE_ACCOUNT_JSON` no falla ni bloquea nada: el aviso sigue
 * saliendo por WhatsApp o Telegram. El push es un canal más, no el único.
 */

type CuentaServicio = { project_id: string; client_email: string; private_key: string }

function cuenta(): CuentaServicio | null {
  const crudo = process.env.FCM_SERVICE_ACCOUNT_JSON
  if (!crudo) return null
  try { return JSON.parse(crudo) as CuentaServicio } catch { return null }
}

let tokenCache: { valor: string; expira: number } | null = null

async function tokenDeAcceso(c: CuentaServicio): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expira - 60_000) return tokenCache.valor
  const ahora = Math.floor(Date.now() / 1000)
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const cabecera = b64({ alg: 'RS256', typ: 'JWT' })
  const cuerpo = b64({
    iss: c.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600,
  })
  const firma = crypto.sign('RSA-SHA256', Buffer.from(`${cabecera}.${cuerpo}`), c.private_key).toString('base64url')
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${cabecera}.${cuerpo}.${firma}` }),
  })
  if (!r.ok) throw new Error(`OAuth de Google: ${r.status}`)
  const d = await r.json() as { access_token: string; expires_in: number }
  tokenCache = { valor: d.access_token, expira: Date.now() + d.expires_in * 1000 }
  return d.access_token
}

export function pushConfigurado(): boolean {
  return cuenta() !== null
}

/** Manda un aviso a todos los teléfonos que siguen ese folio. Devuelve cuántos. */
export async function pushAFolio(folio: string, titulo: string, cuerpo: string, url: string): Promise<number> {
  const c = cuenta()
  if (!c) return 0
  const dispositivos = await prisma.dispositivoPush.findMany({
    where: { folios: { has: folio } }, select: { id: true, token: true },
  })
  if (dispositivos.length === 0) return 0

  const acceso = await tokenDeAcceso(c)
  let enviados = 0
  for (const d of dispositivos) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${c.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: d.token,
          notification: { title: titulo, body: cuerpo },
          data: { url },
          apns: { payload: { aps: { sound: 'default' } } },
          android: { notification: { click_action: 'FLUTTER_NOTIFICATION_CLICK' } },
        },
      }),
    })
    if (r.ok) { enviados++; continue }
    // Token muerto (app desinstalada): se borra para no insistir.
    if (r.status === 404 || r.status === 410) {
      await prisma.dispositivoPush.delete({ where: { id: d.id } }).catch(() => {})
    } else {
      console.error(`[push] FCM ${r.status} para ${folio}`)
    }
  }
  return enviados
}
