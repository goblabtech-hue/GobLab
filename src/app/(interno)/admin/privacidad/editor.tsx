'use client'

import { useActionState, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, PencilLine, Upload } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { AreaTexto, Campo, Entrada } from '@/components/ui/campo'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { markdownAHtml } from '@/domain/markdown'
import { guardarAviso, type Resultado } from './acciones'

function BotonGuardar() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" tamano="lg" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar versión'}
    </Boton>
  )
}

export function EditorAviso({
  titulo, contenido, hayVigente,
}: { titulo: string; contenido: string; hayVigente: boolean }) {
  const [estado, ejecutar] = useActionState<Resultado, FormData>(guardarAviso, {})
  const [texto, setTexto] = useState(contenido)
  const [vista, setVista] = useState<'escribir' | 'previa'>('escribir')
  const [archivo, setArchivo] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  return (
    <form action={ejecutar} className="space-y-4">
      <Tarjeta>
        <TarjetaCuerpo className="space-y-4">
          <Campo id="titulo" etiqueta="Título del documento" requerido>
            <Entrada id="titulo" name="titulo" defaultValue={titulo} required maxLength={200} />
          </Campo>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div role="tablist" className="flex rounded-lg border border-borde bg-papel p-0.5">
                {([['escribir', 'Escribir', PencilLine], ['previa', 'Vista previa', Eye]] as const).map(
                  ([valor, etiqueta, Icono]) => (
                    <button
                      key={valor} type="button" onClick={() => setVista(valor)}
                      aria-pressed={vista === valor}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                        vista === valor ? 'bg-marca-600 text-white' : 'text-tinta-suave hover:bg-lienzo'
                      }`}
                    >
                      <Icono className="size-3.5" aria-hidden />
                      {etiqueta}
                    </button>
                  ),
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={input} type="file" name="archivo" accept=".txt,.md,.markdown"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    setArchivo(f?.name ?? null)
                    if (f) f.text().then(setTexto)
                  }}
                />
                <Boton type="button" variante="secundario" tamano="sm" onClick={() => input.current?.click()}>
                  <Upload aria-hidden />
                  Subir archivo
                </Boton>
                {archivo && <span className="truncate text-xs text-tinta-suave">{archivo}</span>}
              </div>
            </div>

            {vista === 'escribir' ? (
              <AreaTexto
                id="contenido" name="contenido" value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={22} required
                className="font-mono text-sm leading-relaxed"
                placeholder="Pega aquí el aviso de privacidad…"
              />
            ) : (
              <>
                <input type="hidden" name="contenido" value={texto} />
                <div
                  className="min-h-[28rem] rounded-lg border border-borde bg-papel p-5 [&_a]:text-marca-700 [&_a]:underline [&_h2]:mt-5 [&_h2]:mb-1.5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:font-semibold [&_li]:mt-0.5 [&_p]:mt-2 [&_p]:text-tinta-suave [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-tinta-suave [&_blockquote]:my-4 [&_blockquote]:rounded-lg [&_blockquote]:border [&_blockquote]:border-ambar-600/25 [&_blockquote]:bg-ambar-50 [&_blockquote]:p-4 [&_blockquote_p]:text-ambar-600 [&_blockquote_p]:mt-0"
                  dangerouslySetInnerHTML={{ __html: markdownAHtml(texto) }}
                />
              </>
            )}

            <p className="mt-1.5 text-xs text-tenue">
              Acepta texto pegado tal cual. Para dar formato: <code>##</code> para
              un apartado, <code>-</code> para viñetas, <code>**negritas**</code>.
              Si subes un Word o un PDF, ábrelo, copia el texto y pégalo aquí.
            </p>
          </div>

          <Campo id="notaCambio" etiqueta="¿Qué cambió?"
            ayuda="Queda en el historial. Por ejemplo: «revisión de jurídico, se agregó la Unidad de Transparencia».">
            <Entrada id="notaCambio" name="notaCambio" maxLength={200} />
          </Campo>

          <label className="flex items-start gap-2.5 rounded-lg bg-lienzo p-3 text-sm">
            <input type="checkbox" name="publicar" defaultChecked={!hayVigente}
              className="mt-0.5 size-4 accent-[var(--color-marca-600)]" />
            <span>
              <strong>Publicar esta versión ahora</strong>
              <span className="block text-tinta-suave">
                Sustituye de inmediato lo que ve el ciudadano. Si la dejas sin
                marcar, se guarda como borrador y puedes ponerla en vigor después.
              </span>
            </span>
          </label>

          {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
          {estado.ok && (
            <Alerta tipo="exito">
              Guardado como versión {estado.version}.
            </Alerta>
          )}

          <BotonGuardar />
        </TarjetaCuerpo>
      </Tarjeta>
    </form>
  )
}
