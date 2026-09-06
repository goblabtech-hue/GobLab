'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Image from 'next/image'
import { Camera, X } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { AreaTexto, Campo, Etiqueta, Ayuda } from '@/components/ui/campo'
import { Tarjeta, TarjetaCuerpo, TarjetaTitulo } from '@/components/ui/tarjeta'
import { empezar, resolver, type Resultado } from '../acciones'

function BotonAccion({ texto, cargando, ...props }: {
  texto: string; cargando: string; disabled?: boolean; className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" tamano="lg" disabled={pending || props.disabled} className={props.className}>
      {pending ? cargando : texto}
    </Boton>
  )
}

export function FormularioResolver({
  reporteId, folio, estatus, requiereEvidencia,
}: {
  reporteId: string
  folio: string
  estatus: string
  requiereEvidencia: boolean
}) {
  const [eEmpezar, fEmpezar] = useActionState<Resultado, FormData>(empezar, {})
  const [eResolver, fResolver] = useActionState<Resultado, FormData>(resolver, {})
  const [fotos, setFotos] = useState<File[]>([])
  const input = useRef<HTMLInputElement>(null)

  const previas = useMemo(
    () => fotos.map((f) => ({ nombre: f.name, url: URL.createObjectURL(f) })),
    [fotos],
  )
  useEffect(() => () => previas.forEach((p) => URL.revokeObjectURL(p.url)), [previas])

  useEffect(() => {
    if (!input.current) return
    const dt = new DataTransfer()
    fotos.forEach((f) => dt.items.add(f))
    input.current.files = dt.files
  }, [fotos])

  const faltaEvidencia = requiereEvidencia && fotos.length === 0
  const ocultos = <><input type="hidden" name="reporteId" value={reporteId} /><input type="hidden" name="folio" value={folio} /></>

  return (
    <div className="space-y-4">
      {estatus !== 'en_atencion' && (
        <form action={fEmpezar}>
          {ocultos}
          <BotonAccion texto="Empezar a trabajarlo" cargando="Guardando…" className="w-full" />
          {eEmpezar.error && <Alerta tipo="error" className="mt-2">{eEmpezar.error}</Alerta>}
        </form>
      )}

      <Tarjeta>
        <TarjetaCuerpo>
          <TarjetaTitulo>Marcar como resuelto</TarjetaTitulo>

          <form action={fResolver} className="mt-3 space-y-4">
            {ocultos}

            <div>
              <Etiqueta htmlFor="evidencia">
                Foto del trabajo terminado
                {requiereEvidencia && <span className="text-rojo-600" aria-hidden> *</span>}
              </Etiqueta>
              <Ayuda className="mt-1">
                {requiereEvidencia
                  ? 'Es obligatoria: esta foto se le manda al ciudadano y puede publicarse en la galería de antes y después.'
                  : 'Esta categoría no la exige, pero ayuda mucho.'}
              </Ayuda>

              <input
                ref={input} id="evidencia" name="evidencia" type="file"
                accept="image/*" multiple capture="environment" className="sr-only"
                onChange={(e) => setFotos((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 5))}
              />

              <div className="mt-2 flex flex-wrap gap-2.5">
                {previas.map((p, i) => (
                  <div key={p.url} className="relative">
                    <Image src={p.url} alt={`Evidencia ${i + 1}: ${p.nombre}`} width={112} height={112}
                      unoptimized className="size-28 rounded-lg border border-borde object-cover" />
                    <button
                      type="button"
                      onClick={() => setFotos((f) => f.filter((_, j) => j !== i))}
                      className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full border border-borde bg-papel shadow-sm"
                    >
                      <X className="size-4" aria-hidden />
                      <span className="sr-only">Quitar la foto {i + 1}</span>
                    </button>
                  </div>
                ))}

                {fotos.length < 5 && (
                  <button
                    type="button" onClick={() => input.current?.click()}
                    className="grid size-28 place-items-center gap-1 rounded-lg border border-dashed border-borde text-tinta-suave hover:bg-lienzo"
                  >
                    <Camera className="size-7" aria-hidden />
                    <span className="text-xs">Tomar foto</span>
                  </button>
                )}
              </div>
            </div>

            <Campo id="notaCierre" etiqueta="Nota de cierre"
              ayuda="Qué se hizo. La ve el ciudadano en su seguimiento.">
              <AreaTexto id="notaCierre" name="notaCierre" rows={3} maxLength={500}
                placeholder="Se bacheó con mezcla asfáltica y se compactó." />
            </Campo>

            {faltaEvidencia && (
              <Alerta tipo="aviso">
                Sube al menos una foto del trabajo terminado para poder cerrarlo.
              </Alerta>
            )}
            {eResolver.error && <Alerta tipo="error">{eResolver.error}</Alerta>}

            <BotonAccion
              texto="Marcar como resuelto" cargando="Enviando…"
              disabled={faltaEvidencia} className="w-full"
            />
          </form>
        </TarjetaCuerpo>
      </Tarjeta>
    </div>
  )
}
