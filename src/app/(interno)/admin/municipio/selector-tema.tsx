'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { TEMAS, type Tema } from '@/domain/temas'
import { cn } from '@/domain/formato'

/**
 * Selector de identidad visual con vista previa.
 *
 * Cada opción pinta en miniatura lo que cambia de verdad: la cabecera con su
 * línea de acento, un botón de acción y una tarjeta. No es un catálogo de
 * colores sino de cómo se va a ver el sitio, porque quien elige no es
 * diseñador: es quien decide si el municipio se ve «como el gobierno» o no.
 */
export function SelectorTema({ inicial }: { inicial: Tema }) {
  const [tema, setTema] = useState<Tema>(inicial)

  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">Identidad visual</legend>
      <p className="text-sm text-tinta-suave">
        Cambia los colores de todo el sitio, el bot no. Los colores de estado
        (verde, ámbar, rojo) son iguales en las tres: significan «en tiempo»,
        «por vencer» y «vencido», no identidad.
      </p>
      <input type="hidden" name="tema" value={tema} />

      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(TEMAS) as Tema[]).map((clave) => {
          const t = TEMAS[clave]
          const activo = tema === clave
          return (
            <button
              key={clave}
              type="button"
              onClick={() => setTema(clave)}
              aria-pressed={activo}
              className={cn(
                'rounded-[--radius-tarjeta] border-2 text-left transition-colors',
                activo ? 'border-marca-600' : 'border-borde hover:border-tinta-suave',
              )}
            >
              {/* Miniatura: cabecera, botón, tarjeta. */}
              <div
                className="overflow-hidden rounded-t-[calc(var(--radius-tarjeta)-2px)]"
                style={{ background: t.lienzo }}
              >
                <div
                  className="flex h-8 items-center px-3 text-[11px] font-semibold"
                  style={{
                    background: t.cabecera.fondo,
                    color: t.cabecera.texto,
                    borderBottom: `2px solid ${t.cabecera.acento}`,
                  }}
                >
                  Municipio
                </div>
                <div className="space-y-2 p-3">
                  <div
                    className="h-6 w-2/3 rounded-md"
                    style={{ background: t.marca[600] }}
                    aria-hidden
                  />
                  <div
                    className="space-y-1.5 rounded-md border p-2"
                    style={{ background: t.papel, borderColor: t.borde }}
                    aria-hidden
                  >
                    <div className="h-2 w-3/4 rounded" style={{ background: t.tinta }} />
                    <div className="h-2 w-1/2 rounded" style={{ background: t.tintaSuave, opacity: 0.6 }} />
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-2 p-3">
                <div>
                  <p className="text-sm font-medium">{t.nombre}</p>
                  <p className="mt-0.5 text-xs text-tinta-suave">{t.descripcion}</p>
                </div>
                {activo && <Check className="mt-0.5 size-4 shrink-0 text-marca-600" aria-hidden />}
              </div>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
