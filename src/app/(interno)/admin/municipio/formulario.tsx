'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import dynamic from 'next/dynamic'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { Campo, Entrada } from '@/components/ui/campo'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { guardarMunicipio, type Resultado } from './acciones'
import type { ConfigMunicipio } from '@/infrastructure/config'

const MapaSelector = dynamic(
  () => import('@/components/mapa-selector').then((m) => m.MapaSelector),
  { ssr: false, loading: () => <div className="h-64 w-full animate-pulse rounded-lg bg-lienzo" /> },
)

function BotonGuardar() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" tamano="lg" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar cambios'}
    </Boton>
  )
}

export function FormularioMunicipio({
  inicial, hayReportes,
}: { inicial: ConfigMunicipio; hayReportes: boolean }) {
  const [estado, ejecutar] = useActionState<Resultado, FormData>(guardarMunicipio, {})
  const [lat, setLat] = useState(inicial.centroLat)
  const [lng, setLng] = useState(inicial.centroLng)
  const [zoom, setZoom] = useState(inicial.zoomInicial)
  const [prefijo, setPrefijo] = useState(inicial.prefijoFolio)

  const cambioPrefijo = prefijo.toUpperCase() !== inicial.prefijoFolio

  return (
    <form action={ejecutar} className="space-y-5">
      <Tarjeta>
        <TarjetaCuerpo className="space-y-4">
          <Campo id="nombre" etiqueta="Nombre del municipio" requerido
            ayuda="Aparece en el encabezado del sitio y en cada mensaje del bot.">
            <Entrada id="nombre" name="nombre" defaultValue={inicial.nombre} required maxLength={120} />
          </Campo>

          <Campo id="prefijoFolio" etiqueta="Prefijo del folio" requerido
            ayuda={`De 2 a 5 letras. Los folios se verán así: ${(prefijo || 'MUN').toUpperCase()}-2026-00341`}>
            <Entrada
              id="prefijoFolio" name="prefijoFolio" required
              value={prefijo} onChange={(e) => setPrefijo(e.target.value.toUpperCase())}
              maxLength={5} autoCapitalize="characters"
              className="font-mono tracking-widest uppercase"
            />
          </Campo>

          {cambioPrefijo && hayReportes && (
            <Alerta tipo="aviso" titulo="Cambiar el prefijo arranca una numeración nueva">
              Los folios que ya existen conservan el prefijo anterior, así que
              van a convivir dos formatos. Si es a propósito, adelante; si solo
              querías corregir una letra, es mejor hacerlo antes de que haya
              reportes.
            </Alerta>
          )}

          <Campo id="telEmergencias" etiqueta="Teléfono de emergencias" requerido
            ayuda="El bot manda aquí a la gente ante un incendio, un accidente o una fuga de gas. 911, el corto de tu estado, o un número a 10 dígitos.">
            <Entrada
              id="telEmergencias" name="telEmergencias" type="tel" inputMode="numeric"
              defaultValue={inicial.telEmergencias} required maxLength={20}
            />
          </Campo>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaCuerpo className="space-y-3">
          <div>
            <h2 className="font-semibold">Dónde se centra el mapa</h2>
            <p className="mt-0.5 text-sm text-tinta-suave">
              Toca el mapa para mover el centro. Es donde aparece el mapa cuando
              un ciudadano abre el formulario o el tablero.
            </p>
          </div>

          <input type="hidden" name="centroLat" value={lat} />
          <input type="hidden" name="centroLng" value={lng} />

          <MapaSelector
            lat={lat} lng={lng}
            centro={{ lat, lng, zoom }}
            onCambio={(a, b) => { setLat(a); setLng(b) }}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo id="lat-vista" etiqueta="Latitud">
              <Entrada id="lat-vista" value={lat.toFixed(6)} readOnly className="bg-lienzo font-mono text-sm" />
            </Campo>
            <Campo id="lng-vista" etiqueta="Longitud">
              <Entrada id="lng-vista" value={lng.toFixed(6)} readOnly className="bg-lienzo font-mono text-sm" />
            </Campo>
            <Campo id="zoomInicial" etiqueta="Acercamiento"
              ayuda="8 = todo el estado · 18 = una cuadra">
              <Entrada
                id="zoomInicial" name="zoomInicial" type="number" min={8} max={18}
                value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
              />
            </Campo>
          </div>
        </TarjetaCuerpo>
      </Tarjeta>

      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && <Alerta tipo="exito">Listo, los datos quedaron guardados.</Alerta>}

      <BotonGuardar />
    </form>
  )
}
