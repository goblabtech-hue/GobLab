'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { ImageIcon, Upload, Trash2 } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { subirLogotipo, quitarLogotipo, type ResultadoLogo } from './acciones'

function BotonSubir({ hayArchivo }: { hayArchivo: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending || !hayArchivo}>
      <Upload aria-hidden />
      {pending ? 'Procesando…' : 'Usar este logotipo'}
    </Boton>
  )
}

/**
 * El escudo del municipio en la cabecera.
 *
 * Se enseña cómo queda sobre fondo claro y sobre fondo oscuro antes y
 * después de subirlo, porque el error típico es un escudo con fondo blanco
 * que sobre la cabecera guinda se ve como un rectángulo: el procesado lo
 * evita, y aquí se comprueba de un vistazo.
 */
export function LogotipoMunicipio({
  logoUrl, logoBlancoUrl, municipio,
}: { logoUrl: string | null; logoBlancoUrl: string | null; municipio: string }) {
  const [estado, ejecutar] = useActionState<ResultadoLogo, FormData>(subirLogotipo, {})
  const [archivo, setArchivo] = useState<string | null>(null)
  const [quitando, quitar] = useTransition()
  const [errorQuitar, setErrorQuitar] = useState<string | null>(null)

  const propio = Boolean(logoUrl && logoBlancoUrl)
  const color = propio ? logoUrl! : '/marca/demosvoz.png'
  const blanco = propio ? logoBlancoUrl! : '/marca/demosvoz-blanco.png'

  return (
    <Tarjeta>
      <TarjetaCuerpo className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <ImageIcon className="size-5 text-marca-600" aria-hidden />
            Logotipo en la cabecera
          </h2>
          <p className="mt-1 text-sm text-tinta-suave">
            {propio
              ? `Hoy se muestra el escudo de ${municipio}. Sube otro para cambiarlo, o quítalo para volver al de la plataforma.`
              : 'Hoy se muestra el logotipo de la plataforma. Sube el escudo del municipio y aparecerá en todas las páginas.'}
          </p>
        </div>

        {/* Cómo se ve sobre claro y sobre oscuro. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-borde bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={color} alt="" className="h-9 w-auto" />
            <p className="mt-2 text-xs text-tenue">Sobre cabecera clara</p>
          </div>
          <div className="rounded-lg p-4" style={{ background: '#611232' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={blanco} alt="" className="h-9 w-auto" />
            <p className="mt-2 text-xs text-white/70">Sobre cabecera oscura (se genera solo)</p>
          </div>
        </div>

        <form action={ejecutar} className="flex flex-wrap items-center gap-3">
          <input
            type="file" name="logotipo" accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => setArchivo(e.target.files?.[0]?.name ?? null)}
            className="text-sm file:mr-3 file:rounded-lg file:border file:border-borde file:bg-papel file:px-3 file:py-1.5 file:text-sm"
          />
          <BotonSubir hayArchivo={Boolean(archivo)} />
          {propio && (
            <Boton
              type="button" variante="fantasma" disabled={quitando}
              onClick={() => quitar(async () => {
                const r = await quitarLogotipo()
                if (r.error) setErrorQuitar(r.error)
              })}
            >
              <Trash2 aria-hidden />
              {quitando ? 'Quitando…' : 'Quitar y volver al de la plataforma'}
            </Boton>
          )}
        </form>
        <p className="text-xs text-tenue">
          PNG con fondo transparente es lo ideal. Si es JPG con fondo blanco, el fondo se quita
          solo y se recortan los márgenes. Máximo 10 MB.
        </p>

        {estado.ok && <Alerta tipo="exito">Listo. Ya se ve en la cabecera.</Alerta>}
        {(estado.error || errorQuitar) && <Alerta tipo="error">{estado.error ?? errorQuitar}</Alerta>}
      </TarjetaCuerpo>
    </Tarjeta>
  )
}
