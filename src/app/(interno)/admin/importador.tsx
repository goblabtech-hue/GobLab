'use client'

import { useActionState, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { FileSpreadsheet, Upload } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import type { ResultadoImport } from './acciones'

function BotonSubir({ hayArchivo }: { hayArchivo: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending || !hayArchivo}>
      <Upload aria-hidden />
      {pending ? 'Cargando…' : 'Cargar archivo'}
    </Boton>
  )
}

/**
 * Carga masiva de un catálogo. Se usa igual para colonias y dependencias: lo
 * único que cambia son las columnas que se esperan y la acción de servidor.
 */
export function Importador({
  titulo, explicacion, columnas, ejemplo, accion,
}: {
  titulo: string
  explicacion: string
  columnas: { nombre: string; obligatoria: boolean; nota?: string }[]
  ejemplo: string
  accion: (previo: ResultadoImport, datos: FormData) => Promise<ResultadoImport>
}) {
  const [estado, ejecutar] = useActionState<ResultadoImport, FormData>(accion, {})
  const [archivo, setArchivo] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const r = estado.resumen

  return (
    <Tarjeta>
      <TarjetaCuerpo className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <FileSpreadsheet className="size-5 text-marca-600" aria-hidden />
            {titulo}
          </h2>
          <p className="mt-1 text-sm text-tinta-suave">{explicacion}</p>
        </div>

        <div className="rounded-lg bg-lienzo p-3">
          <p className="text-xs font-medium tracking-wide text-tinta-suave uppercase">
            Columnas que lee
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {columnas.map((c) => (
              <li key={c.nombre} className="flex flex-wrap items-baseline gap-x-2">
                <code className="rounded bg-papel px-1.5 py-0.5 text-xs">{c.nombre}</code>
                <span className={c.obligatoria ? 'text-xs font-medium text-rojo-600' : 'text-xs text-tenue'}>
                  {c.obligatoria ? 'obligatoria' : 'opcional'}
                </span>
                {c.nota && <span className="text-xs text-tinta-suave">— {c.nota}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-tinta-suave">
            La primera fila debe traer los nombres de las columnas. No importan
            mayúsculas, acentos ni espacios: <code>{ejemplo}</code> también funciona.
          </p>
        </div>

        <form action={ejecutar} className="space-y-3">
          <input
            ref={input} type="file" name="archivo" accept=".xlsx,.xlsm,.csv,.txt"
            className="sr-only"
            onChange={(e) => setArchivo(e.target.files?.[0]?.name ?? null)}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Boton type="button" variante="secundario" onClick={() => input.current?.click()}>
              Elegir archivo
            </Boton>
            <span className="min-w-0 truncate text-sm text-tinta-suave">
              {archivo ?? 'Ningún archivo elegido'}
            </span>
          </div>

          <BotonSubir hayArchivo={Boolean(archivo)} />
        </form>

        {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}

        {r && (
          <Alerta
            tipo={r.errores.length ? 'aviso' : 'exito'}
            titulo={
              r.errores.length
                ? 'Se cargó, pero hubo renglones con problemas'
                : 'Listo, el catálogo quedó actualizado'
            }
          >
            <p>
              {r.creados} nuevos · {r.actualizados} actualizados
              {r.omitidos > 0 && ` · ${r.omitidos} renglones vacíos que se saltaron`}
            </p>
            {r.errores.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-4">
                {r.errores.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                {r.errores.length > 10 && <li>y {r.errores.length - 10} más…</li>}
              </ul>
            )}
          </Alerta>
        )}

        <p className="text-xs text-tenue">
          Se actualiza por nombre, no se duplica: puedes volver a subir el mismo
          archivo corregido las veces que haga falta. Nada se borra.
        </p>
      </TarjetaCuerpo>
    </Tarjeta>
  )
}
