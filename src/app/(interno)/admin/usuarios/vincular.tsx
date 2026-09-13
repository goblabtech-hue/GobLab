'use client'

import { useState, useTransition } from 'react'
import { Send, Unlink } from 'lucide-react'
import { generarCodigoVinculacion, desvincularTelegram } from '../acciones'

/**
 * Botón para vincular el Telegram de un funcionario.
 *
 * Genera un código y le dice qué escribirle al bot. La vinculación la termina
 * la persona desde su propio teléfono: así nadie puede conectar el chat de
 * otro.
 */
export function VincularTelegram({ userId, vinculado }: { userId: string; vinculado: boolean }) {
  const [codigo, setCodigo] = useState<{ codigo: string; bot: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  if (vinculado) {
    return (
      <span className="inline-flex items-center gap-2 text-sm">
        <span className="text-verde-600">Telegram ✓</span>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => empezar(async () => { await desvincularTelegram(userId) })}
          className="inline-flex items-center gap-1 text-xs text-tinta-suave underline-offset-2 hover:underline"
          title="Quitar la vinculación"
        >
          <Unlink className="size-3" aria-hidden />
          quitar
        </button>
      </span>
    )
  }

  if (codigo) {
    return (
      <div className="text-xs leading-relaxed">
        <p>Desde su Telegram, que le escriba a <strong>{codigo.bot}</strong>:</p>
        <code className="mt-1 inline-block rounded bg-lienzo px-2 py-1 text-sm font-semibold tracking-wider">
          /vincular {codigo.codigo}
        </code>
        <p className="mt-1 text-tenue">Vence en 15 minutos.</p>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        disabled={pendiente}
        onClick={() => empezar(async () => {
          const r = await generarCodigoVinculacion(userId)
          if (r.codigo && r.bot) setCodigo({ codigo: r.codigo, bot: r.bot })
          else setError(r.error ?? 'No se pudo generar el código.')
        })}
        className="inline-flex items-center gap-1 text-xs text-marca-700 underline-offset-2 hover:underline disabled:opacity-50"
      >
        <Send className="size-3" aria-hidden />
        {pendiente ? 'Generando…' : 'Vincular Telegram'}
      </button>
      {error && <p className="mt-1 text-xs text-rojo-600">{error}</p>}
    </div>
  )
}
