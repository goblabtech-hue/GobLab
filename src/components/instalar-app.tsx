'use client'

import { useEffect, useState } from 'react'
import { Smartphone, Share, X } from 'lucide-react'

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/**
 * Registra el service worker y ofrece instalar la app.
 *
 * Android avisa cuando el sitio se puede instalar (`beforeinstallprompt`) y
 * se le enseña un botón. iOS no avisa nunca: ahí se explica el gesto —
 * Compartir → Agregar a inicio — que casi nadie conoce. Se muestra una vez;
 * si la persona lo cierra, no se insiste en dos semanas.
 */
export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null)
  const [esIos, setEsIos] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    // Ya instalada, o dentro de la app de las tiendas: no hay nada que ofrecer.
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (document.documentElement.dataset.app) return
    try {
      const cerrado = localStorage.getItem('instalar-cerrado')
      if (cerrado && Date.now() - Number(cerrado) < 14 * 86_400_000) return
    } catch { /* sin storage: se muestra igual */ }

    // Fuera del render síncrono del efecto: React pide que el estado que sale
    // de un efecto se fije en respuesta a algo, no al montar.
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window)
    const temporizador = ios
      ? window.setTimeout(() => { setEsIos(true); setVisible(true) }, 1500)
      : undefined

    const alPoderInstalar = (e: Event) => {
      e.preventDefault()
      setEvento(e as EventoInstalar)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', alPoderInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', alPoderInstalar)
      if (temporizador) window.clearTimeout(temporizador)
    }
  }, [])

  const cerrar = () => {
    setVisible(false)
    try { localStorage.setItem('instalar-cerrado', String(Date.now())) } catch { /* nada */ }
  }

  const instalar = async () => {
    if (!evento) return
    await evento.prompt()
    const { outcome } = await evento.userChoice
    if (outcome === 'accepted') setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Instalar la aplicación"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-[--radius-tarjeta] border border-borde bg-papel p-3 shadow-lg sm:inset-x-auto sm:right-4 sm:bottom-4"
    >
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-marca-600" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">Ten DemosVoz en tu teléfono</p>
          {esIos ? (
            <p className="mt-0.5 text-tinta-suave">
              Toca <Share className="inline size-4 align-text-bottom" aria-label="Compartir" /> abajo y luego
              <strong> «Agregar a inicio»</strong>. Queda como cualquier app.
            </p>
          ) : (
            <p className="mt-0.5 text-tinta-suave">Con ícono y sin barra del navegador. No ocupa casi nada.</p>
          )}
          {!esIos && evento && (
            <button
              type="button"
              onClick={instalar}
              className="btn-principal mt-2 inline-flex h-9 items-center rounded-lg bg-marca-600 px-3 text-sm font-medium text-white"
            >
              Instalar
            </button>
          )}
        </div>
        <button type="button" onClick={cerrar} className="-m-1 p-1 text-tenue hover:text-tinta" aria-label="Cerrar">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
