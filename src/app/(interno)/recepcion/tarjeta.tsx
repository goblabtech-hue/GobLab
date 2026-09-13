'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Image from 'next/image'
import { Check, X, MapPin, EyeOff } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { ORIGEN } from '@/domain/presentacion'
import { haceCuanto } from '@/domain/formato'
import { registrar, rechazar, type Resultado } from './acciones'

type Reporte = {
  id: string; folio: string; descripcion: string; direccionTexto: string | null
  origen: string; createdAt: Date; lat: number | null; lng: number | null; prioridad: string
  categoria: { id: number; nombre: string }; colonia: { nombre: string } | null
  fotos: { id: string; url: string }[]
}

function BotonEnvio({ texto, variante }: { texto: string; variante: 'principal' | 'peligro' }) {
  const { pending } = useFormStatus()
  return <Boton type="submit" variante={variante} disabled={pending}>{pending ? 'Un momento…' : texto}</Boton>
}

/**
 * Un reporte esperando que una persona decida. Se ve todo lo que mandó el
 * ciudadano —texto, fotos, ubicación— porque eso es lo que se está juzgando.
 */
export function TarjetaRecepcion({ r, categorias }: { r: Reporte; categorias: { id: number; nombre: string }[] }) {
  const [modo, setModo] = useState<'ver' | 'rechazar'>('ver')
  const [ra, registrarAccion] = useActionState<Resultado, FormData>(registrar, {})
  const [rr, rechazarAccion] = useActionState<Resultado, FormData>(rechazar, {})

  if (ra.ok || rr.ok) return null

  return (
    <Tarjeta className="overflow-hidden">
      <TarjetaCuerpo className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <code className="font-semibold">{r.folio}</code>
          <span className="text-tenue">·</span>
          <span className="text-tinta-suave">{ORIGEN[r.origen as keyof typeof ORIGEN] ?? r.origen}</span>
          <span className="text-tenue">·</span>
          <span className="text-tinta-suave">{haceCuanto(r.createdAt)}</span>
          {r.prioridad !== 'normal' && <Insignia tono={r.prioridad === 'urgente' ? 'rojo' : 'ambar'}>{r.prioridad}</Insignia>}
        </div>

        <p className="text-lg leading-snug text-pretty">{r.descripcion}</p>

        {(r.direccionTexto || r.colonia || r.lat != null) && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-tinta-suave">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {[r.direccionTexto, r.colonia && !r.direccionTexto?.includes(r.colonia.nombre) ? `Col. ${r.colonia.nombre}` : null].filter(Boolean).join(' · ') || 'Solo coordenadas'}
            {r.lat != null && r.lng != null && (
              <a href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=17/${r.lat}/${r.lng}`} target="_blank" rel="noopener noreferrer" className="underline">ver en el mapa</a>
            )}
          </p>
        )}

        {r.fotos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {r.fotos.map((f) => (
              <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer">
                <Image src={f.url} alt="" width={200} height={150} className="h-28 w-auto rounded-lg border border-borde object-cover" unoptimized />
              </a>
            ))}
          </div>
        )}

        {modo === 'ver' ? (
          <form action={registrarAccion} className="flex flex-wrap items-end gap-3 border-t border-borde pt-4">
            <input type="hidden" name="reporteId" value={r.id} />
            <label className="text-sm">
              <span className="block text-xs text-tinta-suave">Categoría</span>
              <select name="categoriaId" defaultValue={r.categoria.id} className="mt-1 h-10 rounded-lg border border-borde bg-papel px-3 text-sm">
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label className="flex h-10 items-center gap-2 text-sm">
              <input type="checkbox" name="ocultarContenido" className="size-4" />
              <EyeOff className="size-4 text-tinta-suave" aria-hidden />
              No mostrar texto ni fotos al público
            </label>
            <div className="ml-auto flex gap-2">
              <Boton type="button" variante="secundario" onClick={() => setModo('rechazar')}><X aria-hidden />No registrar</Boton>
              <BotonEnvio texto="Registrar" variante="principal" />
            </div>
            {ra.error && <Alerta tipo="error" className="w-full">{ra.error}</Alerta>}
          </form>
        ) : (
          <form action={rechazarAccion} className="space-y-3 border-t border-borde pt-4">
            <input type="hidden" name="reporteId" value={r.id} />
            <label className="block text-sm">
              <span className="text-tinta-suave">Por qué no se registra — el ciudadano lo va a leer</span>
              <textarea name="motivo" required minLength={5} rows={2} className="mt-1 w-full rounded-lg border border-borde bg-papel px-3 py-2 text-sm"
                placeholder="Ej.: El contenido no corresponde a un problema de servicios públicos." />
            </label>
            <div className="flex justify-end gap-2">
              <Boton type="button" variante="secundario" onClick={() => setModo('ver')}>Volver</Boton>
              <BotonEnvio texto="Confirmar: no registrar" variante="peligro" />
            </div>
            {rr.error && <Alerta tipo="error">{rr.error}</Alerta>}
          </form>
        )}
        <Check className="hidden" aria-hidden />
      </TarjetaCuerpo>
    </Tarjeta>
  )
}
