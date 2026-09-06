'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus, X } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { Campo, Entrada, Selector, AreaTexto } from '@/components/ui/campo'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import type { Resultado } from './acciones'

export type CampoDef = {
  nombre: string
  etiqueta: string
  tipo: 'texto' | 'numero' | 'select' | 'checkbox' | 'fecha' | 'password' | 'area'
  opciones?: { valor: string | number; texto: string }[]
  requerido?: boolean
  ayuda?: string
  min?: number
  max?: number
  soloAlCrear?: boolean
}

/**
 * Una fila ya resuelta por el servidor. Las celdas viajan como elementos React
 * ya renderizados y los valores del formulario como datos planos: pasar
 * funciones de render a un componente de cliente no está permitido, y
 * convertir cada página de catálogo en cliente obligaría a mandar toda la
 * consulta de Prisma al navegador.
 */
export type FilaCatalogo = {
  id: string | number
  celdas: React.ReactNode[]
  valores: Record<string, string | number | boolean | null>
}

function BotonGuardar({ nuevo }: { nuevo: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending}>
      {pending ? 'Guardando…' : nuevo ? 'Agregar' : 'Guardar cambios'}
    </Boton>
  )
}

/**
 * Pantalla genérica de catálogo: tabla + formulario de alta/edición.
 * Todos los catálogos del SPEC §3 comparten esta forma, así que vale la pena
 * una sola implementación bien hecha en accesibilidad en vez de cinco copias.
 */
export function Catalogo({
  titulo,
  descripcion,
  encabezados,
  filas,
  campos,
  accion,
  etiquetaNuevo = 'Agregar',
}: {
  titulo: string
  descripcion?: string
  encabezados: string[]
  filas: FilaCatalogo[]
  campos: CampoDef[]
  accion: (previo: Resultado, datos: FormData) => Promise<Resultado>
  etiquetaNuevo?: string
}) {
  const [editando, setEditando] = useState<FilaCatalogo | null>(null)
  const [abierto, setAbierto] = useState(false)

  // El cierre del panel se decide al terminar la acción, no en un efecto que
  // observe el resultado: así no hay un render intermedio con el panel abierto
  // y el estado ya en "ok".
  const [estado, ejecutar] = useActionState<Resultado, FormData>(
    async (previo, datos) => {
      const resultado = await accion(previo, datos)
      if (resultado.ok) {
        setAbierto(false)
        setEditando(null)
      }
      return resultado
    },
    {},
  )

  const valores = editando?.valores ?? {}
  const esNuevo = !editando

  function abrirNuevo() {
    setEditando(null)
    setAbierto(true)
  }
  function abrirEdicion(fila: FilaCatalogo) {
    setEditando(fila)
    setAbierto(true)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
          {descripcion && <p className="mt-1 max-w-2xl text-sm text-tinta-suave">{descripcion}</p>}
        </div>
        {!abierto && (
          <Boton onClick={abrirNuevo}>
            <Plus aria-hidden />
            {etiquetaNuevo}
          </Boton>
        )}
      </div>

      {abierto && (
        <Tarjeta>
          <TarjetaCuerpo>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">{esNuevo ? etiquetaNuevo : 'Editar'}</h2>
              <Boton
                variante="fantasma" tamano="icono"
                onClick={() => { setAbierto(false); setEditando(null) }}
              >
                <X aria-hidden />
                <span className="sr-only">Cerrar</span>
              </Boton>
            </div>

            <form
              action={ejecutar}
              // remonta los inputs al cambiar de registro para que los
              // defaultValue se refresquen
              key={editando ? String(editando.id) : 'nuevo'}
              className="grid gap-4 sm:grid-cols-2"
            >
              {!esNuevo && <input type="hidden" name="id" value={String(editando!.id)} />}

              {campos
                .filter((c) => !(c.soloAlCrear && !esNuevo))
                .map((c) => {
                  const id = `campo-${c.nombre}`
                  const valor = valores[c.nombre]

                  if (c.tipo === 'checkbox') {
                    return (
                      <label key={c.nombre} className="flex items-center gap-2.5 self-end pb-2.5 text-sm">
                        <input
                          id={id} name={c.nombre} type="checkbox"
                          defaultChecked={valor === undefined ? true : Boolean(valor)}
                          className="size-4 accent-[var(--color-marca-600)]"
                        />
                        {c.etiqueta}
                      </label>
                    )
                  }

                  return (
                    <Campo
                      key={c.nombre} id={id} etiqueta={c.etiqueta}
                      ayuda={c.ayuda} requerido={c.requerido}
                      className={c.tipo === 'area' ? 'sm:col-span-2' : undefined}
                    >
                      {c.tipo === 'select' ? (
                        <Selector id={id} name={c.nombre} defaultValue={valor == null ? '' : String(valor)} required={c.requerido}>
                          <option value="">Selecciona…</option>
                          {c.opciones?.map((o) => (
                            <option key={o.valor} value={o.valor}>{o.texto}</option>
                          ))}
                        </Selector>
                      ) : c.tipo === 'area' ? (
                        <AreaTexto id={id} name={c.nombre} defaultValue={valor == null ? '' : String(valor)} required={c.requerido} />
                      ) : (
                        <Entrada
                          id={id} name={c.nombre}
                          type={c.tipo === 'numero' ? 'number' : c.tipo === 'fecha' ? 'date' : c.tipo === 'password' ? 'password' : 'text'}
                          defaultValue={c.tipo === 'password' ? '' : valor == null ? '' : String(valor)}
                          required={c.requerido} min={c.min} max={c.max}
                          step={c.tipo === 'numero' ? 'any' : undefined}
                          autoComplete={c.tipo === 'password' ? 'new-password' : undefined}
                        />
                      )}
                    </Campo>
                  )
                })}

              <div className="sm:col-span-2">
                {estado.error && <Alerta tipo="error" className="mb-3">{estado.error}</Alerta>}
                <BotonGuardar nuevo={esNuevo} />
              </div>
            </form>
          </TarjetaCuerpo>
        </Tarjeta>
      )}

      <Tarjeta className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-lienzo text-left text-xs tracking-wide text-tinta-suave uppercase">
              <tr>
                {encabezados.map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 font-medium">{h}</th>
                ))}
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {filas.map((fila) => (
                <tr key={fila.id} className="hover:bg-lienzo/60">
                  {fila.celdas.map((celda, i) => (
                    <td key={encabezados[i] ?? i} className="px-4 py-3">{celda}</td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <Boton variante="fantasma" tamano="sm" onClick={() => abrirEdicion(fila)}>
                      Editar
                    </Boton>
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={encabezados.length + 1} className="px-4 py-10 text-center text-tinta-suave">
                    Todavía no hay registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  )
}
