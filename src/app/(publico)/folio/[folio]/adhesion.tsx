'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Users } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { Campo, Entrada } from '@/components/ui/campo'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { unirseAReporte, type EstadoAdhesion } from '@/app/(publico)/reportar/acciones'

function BotonUnirme() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending}>
      {pending ? 'Sumándote…' : 'Sumarme a este reporte'}
    </Boton>
  )
}

export function FormularioAdhesion({ reporteId, folio }: { reporteId: string; folio: string }) {
  const [estado, ejecutar] = useActionState<EstadoAdhesion, FormData>(unirseAReporte, {})

  return (
    <section className="mt-6">
      <Tarjeta className="border-marca-200 bg-marca-50/50">
        <TarjetaCuerpo>
          <div className="flex gap-3">
            <Users className="mt-0.5 size-5 shrink-0 text-marca-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">¿También te afecta este problema?</h2>
              <p className="mt-1 mb-3 text-sm text-tinta-suave">
                Súmate al folio {folio} en vez de abrir otro reporte. Los reportes
                con más vecinos sumados suben de prioridad, y te avisamos cuando
                se resuelva.
              </p>

              <form action={ejecutar} className="space-y-3">
                <input type="hidden" name="reporteId" value={reporteId} />
                <Campo id="telefono-adhesion" etiqueta="Tu teléfono" requerido
                  ayuda="10 dígitos. Solo lo usamos para avisarte; no se publica.">
                  <Entrada id="telefono-adhesion" name="telefono" type="tel"
                    inputMode="numeric" autoComplete="tel" required placeholder="55 1234 5678" />
                </Campo>
                {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
                <BotonUnirme />
              </form>
            </div>
          </div>
        </TarjetaCuerpo>
      </Tarjeta>
    </section>
  )
}
