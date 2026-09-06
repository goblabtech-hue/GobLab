'use client'

import { useState, useTransition } from 'react'
import { Eye } from 'lucide-react'
import { verTelefono } from '../acciones'

/**
 * El número completo se pide bajo demanda en vez de venir en el HTML: así una
 * pantalla compartida o una captura de la bandeja no expone teléfonos, y cada
 * consulta queda en la bitácora del reporte.
 */
export function BotonTelefono({ reporteId, mascara }: { reporteId: string; mascara: string }) {
  const [telefono, setTelefono] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, empezar] = useTransition()

  if (telefono) {
    return (
      <a href={`tel:${telefono}`} className="font-medium text-marca-700 underline">
        {telefono.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3')}
      </a>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono">{mascara}</span>
      <button
        type="button"
        disabled={cargando}
        onClick={() =>
          empezar(async () => {
            const r = await verTelefono(reporteId)
            if (r.telefono) setTelefono(r.telefono)
            else setError(r.error ?? 'No se pudo mostrar.')
          })
        }
        className="inline-flex items-center gap-1 text-xs font-medium text-marca-700 underline"
      >
        <Eye className="size-3.5" aria-hidden />
        {cargando ? 'Mostrando…' : 'Ver completo'}
      </button>
      {error && <span className="text-xs text-rojo-600">{error}</span>}
    </span>
  )
}
