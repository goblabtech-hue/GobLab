'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Star } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { AreaTexto, Campo } from '@/components/ui/campo'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { calificar, reabrir, type EstadoCalificacion, type EstadoReapertura } from '../acciones'

const LEYENDAS = ['', 'Muy mal', 'Mal', 'Regular', 'Bien', 'Excelente']

function Estrellas({ valor, onCambio }: { valor: number; onCambio: (n: number) => void }) {
  const [encima, setEncima] = useState(0)
  const mostrado = encima || valor

  return (
    <div>
      <div role="radiogroup" aria-label="Calificación de 1 a 5 estrellas" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button" role="radio" aria-checked={valor === n}
            aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}: ${LEYENDAS[n]}`}
            onClick={() => onCambio(n)}
            onMouseEnter={() => setEncima(n)}
            onMouseLeave={() => setEncima(0)}
            onFocus={() => setEncima(n)}
            onBlur={() => setEncima(0)}
            className="rounded p-1"
          >
            <Star
              className={`size-9 transition-colors ${
                n <= mostrado ? 'fill-ambar-600 text-ambar-600' : 'text-borde'
              }`}
              aria-hidden
            />
          </button>
        ))}
      </div>
      <p className="mt-1 h-5 text-sm text-tinta-suave">{mostrado ? LEYENDAS[mostrado] : ''}</p>
    </div>
  )
}

function BotonEnviar({ texto, cargando }: { texto: string; cargando: string }) {
  const { pending } = useFormStatus()
  return <Boton type="submit" disabled={pending}>{pending ? cargando : texto}</Boton>
}

export function PanelCalificacion({
  folio, estatus, calificacion, comentario, yaSeReabrio,
}: {
  folio: string
  estatus: string
  calificacion: number | null
  comentario: string | null
  yaSeReabrio: boolean
}) {
  const [estrellas, setEstrellas] = useState(0)
  const [estadoCal, ejecutarCal] = useActionState<EstadoCalificacion, FormData>(calificar, {})
  const [estadoReab, ejecutarReab] = useActionState<EstadoReapertura, FormData>(reabrir, {})

  // Pedir calificación: solo cuando el trabajo está hecho y nadie ha calificado.
  if (estatus === 'resuelto' && calificacion === null && !estadoCal.ok) {
    return (
      <section className="mt-6">
        <h2 className="mb-2 text-base font-semibold">¿Cómo quedó?</h2>
        <Tarjeta>
          <TarjetaCuerpo>
            <p className="mb-3 text-sm text-tinta-suave">
              Tu calificación es la principal forma que tenemos de saber si de
              verdad resolvimos tu problema.
            </p>

            <form action={ejecutarCal} className="space-y-4">
              <input type="hidden" name="folio" value={folio} />
              <input type="hidden" name="calificacion" value={estrellas} />

              <Estrellas valor={estrellas} onCambio={setEstrellas} />

              <Campo id="comentario" etiqueta="¿Quieres contarnos algo más?">
                <AreaTexto id="comentario" name="comentario" maxLength={500} rows={3}
                  placeholder="Quedó muy bien, gracias" />
              </Campo>

              {estadoCal.error && <Alerta tipo="error">{estadoCal.error}</Alerta>}

              <div className={estrellas === 0 ? 'pointer-events-none opacity-50' : ''}>
                <BotonEnviar texto="Enviar mi calificación" cargando="Enviando…" />
              </div>
            </form>
          </TarjetaCuerpo>
        </Tarjeta>
      </section>
    )
  }

  const calFinal = estadoCal.ok ? estrellas : calificacion
  if (calFinal === null) return null

  const puedeReabrir = calFinal <= 2 && !yaSeReabrio && estatus !== 'reabierto' && !estadoReab.ok

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-base font-semibold">Tu calificación</h2>
      <Tarjeta>
        <TarjetaCuerpo className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex" aria-label={`${calFinal} de 5 estrellas`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n}
                  className={`size-5 ${n <= calFinal ? 'fill-ambar-600 text-ambar-600' : 'text-borde'}`}
                  aria-hidden />
              ))}
            </div>
            <span className="text-sm text-tinta-suave">{LEYENDAS[calFinal]}</span>
          </div>

          {comentario && <p className="text-sm text-tinta-suave">«{comentario}»</p>}
          {estadoCal.ok && <Alerta tipo="exito">Gracias, ya la registramos.</Alerta>}

          {puedeReabrir && (
            <form action={ejecutarReab} className="space-y-3 border-t border-borde pt-3">
              <input type="hidden" name="folio" value={folio} />
              <p className="text-sm text-tinta-suave">
                Nos dices que no quedó bien. ¿Quieres que lo revisemos otra vez?
                Se puede reabrir una sola vez.
              </p>
              <Campo id="motivo" etiqueta="¿Qué sigue mal?" requerido>
                <AreaTexto id="motivo" name="motivo" required maxLength={500} rows={2}
                  placeholder="Taparon el bache pero ya se volvió a hundir." />
              </Campo>
              {estadoReab.error && <Alerta tipo="error">{estadoReab.error}</Alerta>}
              <BotonEnviar texto="Pedir que lo revisen otra vez" cargando="Enviando…" />
            </form>
          )}

          {estadoReab.ok && (
            <Alerta tipo="exito" titulo="Listo, lo reabrimos">
              Tu reporte volvió a la cuadrilla. Te avisamos cuando lo revisen.
            </Alerta>
          )}
        </TarjetaCuerpo>
      </Tarjeta>
    </section>
  )
}
