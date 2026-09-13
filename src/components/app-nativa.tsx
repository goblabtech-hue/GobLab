'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

const CLAVE_TOKEN = 'push-token'

/**
 * Lo que solo pasa cuando el sitio corre dentro de la app de las tiendas.
 *
 * Registra el teléfono para notificaciones y guarda el token; cada vez que
 * la persona levanta o consulta un folio, `ligarFolio` lo manda con ese
 * folio. En el navegador normal no hace nada: Capacitor sabe que no es la
 * app.
 */
export function AppNativa() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    document.documentElement.dataset.app = Capacitor.getPlatform()

    ;(async () => {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const permiso = await PushNotifications.requestPermissions()
      if (permiso.receive !== 'granted') return
      await PushNotifications.addListener('registration', async ({ value }) => {
        try { localStorage.setItem(CLAVE_TOKEN, value) } catch { /* nada */ }
        await fetch('/api/app/dispositivo', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: value, plataforma: Capacitor.getPlatform() }),
        }).catch(() => {})
      })
      // Al tocar una notificación, se abre lo que trae en `url`.
      await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const url = (notification.data as { url?: string } | undefined)?.url
        if (url) window.location.assign(url)
      })
      await PushNotifications.register()
    })().catch(() => {})
  }, [])
  return null
}

/** Liga este teléfono a un folio, para avisarle por push de lo que pase. */
export async function ligarFolio(folio: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  let token: string | null = null
  try { token = localStorage.getItem(CLAVE_TOKEN) } catch { /* nada */ }
  if (!token) return
  await fetch('/api/app/dispositivo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, plataforma: Capacitor.getPlatform(), folio }),
  }).catch(() => {})
}
