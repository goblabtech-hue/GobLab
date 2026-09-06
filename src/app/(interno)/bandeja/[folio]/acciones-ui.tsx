'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowLeftRight, Ban, Copy, PlayCircle, UserCheck } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { AreaTexto, Campo, Selector } from '@/components/ui/campo'
import { Tarjeta, TarjetaCuerpo, TarjetaTitulo } from '@/components/ui/tarjeta'
import {
  accionAsignar, accionReasignar, accionImprocedente, accionDuplicado,
  accionIniciarAtencion, type Resultado,
} from '../acciones'

type Opcion = { id: string | number; nombre: string }

function Guardar({ texto }: { texto: string }) {
  const { pending } = useFormStatus()
  return <Boton type="submit" disabled={pending} className="w-full">{pending ? 'Guardando…' : texto}</Boton>
}

function Seccion({
  titulo, icono: Icono, abierto, onToggle, children,
}: {
  titulo: string
  icono: React.ElementType
  abierto: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-borde pt-3 first:border-0 first:pt-0">
      <button
        type="button" onClick={onToggle} aria-expanded={abierto}
        className="flex w-full items-center gap-2 text-left text-sm font-medium hover:text-marca-700"
      >
        <Icono className="size-4 shrink-0 text-tinta-suave" aria-hidden />
        {titulo}
      </button>
      {abierto && <div className="mt-3">{children}</div>}
    </div>
  )
}

export function PanelAcciones({
  reporteId, folio, estatus, dependenciaActual, asignadoA, dependencias, cuadrillas, cercanos,
}: {
  reporteId: string
  folio: string
  estatus: string
  dependenciaActual: number
  asignadoA: { id: string; nombre: string } | null
  dependencias: Opcion[]
  cuadrillas: Opcion[]
  cercanos: { id: string; folio: string; metros: number }[]
}) {
  const [abierta, setAbierta] = useState<string | null>('asignar')
  const alterna = (k: string) => setAbierta((a) => (a === k ? null : k))

  const [eAsignar, fAsignar] = useActionState<Resultado, FormData>(accionAsignar, {})
  const [eReasignar, fReasignar] = useActionState<Resultado, FormData>(accionReasignar, {})
  const [eImproc, fImproc] = useActionState<Resultado, FormData>(accionImprocedente, {})
  const [eDup, fDup] = useActionState<Resultado, FormData>(accionDuplicado, {})
  const [eAtencion, fAtencion] = useActionState<Resultado, FormData>(accionIniciarAtencion, {})

  const cerrado = ['cerrado', 'duplicado', 'improcedente'].includes(estatus)
  const ocultos = <><input type="hidden" name="reporteId" value={reporteId} /><input type="hidden" name="folio" value={folio} /></>

  if (cerrado) {
    return (
      <Tarjeta className="h-fit">
        <TarjetaCuerpo>
          <TarjetaTitulo>Acciones</TarjetaTitulo>
          <p className="mt-2 text-sm text-tinta-suave">
            Este reporte ya está cerrado. Si el problema sigue, lo correcto es
            levantar uno nuevo para no perder la trazabilidad del anterior.
          </p>
        </TarjetaCuerpo>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta className="h-fit lg:sticky lg:top-20">
      <TarjetaCuerpo className="space-y-3">
        <TarjetaTitulo>Acciones</TarjetaTitulo>

        <Seccion titulo="Asignar cuadrilla" icono={UserCheck} abierto={abierta === 'asignar'} onToggle={() => alterna('asignar')}>
          {asignadoA && <p className="mb-2 text-sm text-tinta-suave">Ahora: {asignadoA.nombre}</p>}
          <form action={fAsignar} className="space-y-2.5">
            {ocultos}
            <Selector name="cuadrillaId" defaultValue={asignadoA?.id ?? ''} aria-label="Cuadrilla" required>
              <option value="">Elige a quién…</option>
              {cuadrillas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Selector>
            {eAsignar.error && <Alerta tipo="error">{eAsignar.error}</Alerta>}
            <Guardar texto="Asignar" />
          </form>
          {cuadrillas.length === 0 && (
            <p className="mt-2 text-sm text-tinta-suave">
              No hay cuadrillas activas en esta dependencia.
            </p>
          )}
        </Seccion>

        {estatus !== 'en_atencion' && (
          <Seccion titulo="Poner en atención" icono={PlayCircle} abierto={abierta === 'atencion'} onToggle={() => alterna('atencion')}>
            <form action={fAtencion} className="space-y-2.5">
              {ocultos}
              <p className="text-sm text-tinta-suave">
                Marca que la cuadrilla ya está trabajando en este reporte.
              </p>
              {eAtencion.error && <Alerta tipo="error">{eAtencion.error}</Alerta>}
              <Guardar texto="Poner en atención" />
            </form>
          </Seccion>
        )}

        <Seccion titulo="Reasignar a otra dependencia" icono={ArrowLeftRight} abierto={abierta === 'reasignar'} onToggle={() => alterna('reasignar')}>
          <form action={fReasignar} className="space-y-2.5">
            {ocultos}
            <Selector name="dependenciaId" defaultValue="" aria-label="Dependencia" required>
              <option value="">Elige la dependencia…</option>
              {dependencias.filter((d) => d.id !== dependenciaActual).map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </Selector>
            <Campo id="motivo-reasignar" etiqueta="Motivo" requerido
              ayuda="Se mide como señal de mal ruteo: di por qué no correspondía.">
              <AreaTexto id="motivo-reasignar" name="motivo" rows={2} required minLength={10} />
            </Campo>
            {eReasignar.error && <Alerta tipo="error">{eReasignar.error}</Alerta>}
            <Guardar texto="Reasignar" />
          </form>
        </Seccion>

        {cercanos.length > 0 && (
          <Seccion titulo={`Unir a otro reporte (${cercanos.length} cerca)`} icono={Copy} abierto={abierta === 'duplicado'} onToggle={() => alterna('duplicado')}>
            <form action={fDup} className="space-y-2.5">
              {ocultos}
              <Selector name="originalId" defaultValue="" aria-label="Reporte original" required>
                <option value="">Elige el reporte original…</option>
                {cercanos.map((c) => (
                  <option key={c.id} value={c.id}>{c.folio} · a {c.metros} m</option>
                ))}
              </Selector>
              {eDup.error && <Alerta tipo="error">{eDup.error}</Alerta>}
              <Guardar texto="Marcar como duplicado" />
            </form>
          </Seccion>
        )}

        <Seccion titulo="Marcar improcedente" icono={Ban} abierto={abierta === 'improcedente'} onToggle={() => alterna('improcedente')}>
          <form action={fImproc} className="space-y-2.5">
            {ocultos}
            <Campo id="motivo-improcedente" etiqueta="Motivo" requerido
              ayuda="Este texto lo lee el ciudadano en su página de seguimiento.">
              <AreaTexto id="motivo-improcedente" name="motivo" rows={3} required minLength={15}
                placeholder="La vialidad es estatal; el municipio no puede intervenir." />
            </Campo>
            {eImproc.error && <Alerta tipo="error">{eImproc.error}</Alerta>}
            <Guardar texto="Marcar improcedente" />
          </form>
        </Seccion>
      </TarjetaCuerpo>
    </Tarjeta>
  )
}
