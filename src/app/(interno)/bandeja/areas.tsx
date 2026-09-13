import Link from 'next/link'
import { ArrowDownToLine, CheckCircle2 } from 'lucide-react'
import { numero } from '@/domain/formato'
import type { CargaArea } from '@/application/reportes'
import { SelloDependencia } from '@/components/sello-dependencia'

/**
 * Carga de trabajo por área responsable.
 *
 * Cada tarjeta lleva al listado filtrado por esa área. El número de vencidos va
 * primero en el orden porque es lo que exige acción: un área con 24 abiertos y
 * cero vencidos está al corriente; una con 8 y 5 vencidos, no.
 */
export function ResumenAreas({ areas }: { areas: CargaArea[] }) {
  if (areas.length === 0) return null

  const llegaron = areas.reduce((n, a) => n + a.llegaron7d, 0)
  const resueltos = areas.reduce((n, a) => n + a.resueltos7d, 0)
  // Si resuelve menos de lo que le llega, el rezago crece: eso es lo que
  // hay que ver de un vistazo, no los dos números por separado.
  const saldo = resueltos - llegaron

  return (
    <section aria-labelledby="areas">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="areas" className="text-sm font-medium text-tinta-suave">
          Carga por área responsable
        </h2>
        <p className="flex flex-wrap items-center gap-x-3 text-sm" aria-label="Últimos 7 días">
          <span className="text-tinta-suave">Últimos 7 días:</span>
          <span className="inline-flex items-center gap-1 tabular-nums"><ArrowDownToLine className="size-3.5 text-azul-600" aria-hidden />{numero(llegaron)} llegaron</span>
          <span className="inline-flex items-center gap-1 tabular-nums"><CheckCircle2 className="size-3.5 text-verde-600" aria-hidden />{numero(resueltos)} resueltos</span>
          <span className={`text-xs font-medium ${saldo < 0 ? 'text-rojo-600' : saldo > 0 ? 'text-verde-600' : 'text-tenue'}`}>
            {saldo < 0 ? `el rezago creció ${numero(-saldo)}` : saldo > 0 ? `el rezago bajó ${numero(saldo)}` : 'al parejo'}
          </span>
        </p>
      </div>

      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {areas.map((a) => (
          <li key={a.id}>
            <Link
              href={`/bandeja?dependencia=${a.id}&estatus=abiertos`}
              className="block h-full rounded-[--radius-tarjeta] border border-borde bg-papel p-3.5 transition-colors hover:border-marca-200 hover:bg-marca-50/40"
            >
              <p className="flex items-start gap-2">
                <SelloDependencia dependencia={a} tamano="mediano" />
                <span className="line-clamp-2 text-sm leading-snug font-medium">{a.nombre}</span>
              </p>

              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tabular-nums">{numero(a.abiertos)}</span>
                <span className="text-xs text-tinta-suave">abiertos</span>
              </p>

              <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
                <span className={a.vencidos > 0 ? 'font-medium text-rojo-600' : 'text-tenue'}>
                  {numero(a.vencidos)} vencidos
                </span>
                {a.sinCuadrilla > 0 && (
                  <span className="text-ambar-600">{numero(a.sinCuadrilla)} sin cuadrilla</span>
                )}
              </p>

              <p className="mt-2 flex items-center gap-2.5 border-t border-borde pt-2 text-xs text-tinta-suave" title="Últimos 7 días">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <ArrowDownToLine className="size-3.5 text-azul-600" aria-hidden />{numero(a.llegaron7d)}
                  <span className="sr-only">llegaron en 7 días</span>
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <CheckCircle2 className="size-3.5 text-verde-600" aria-hidden />{numero(a.resueltos7d)}
                  <span className="sr-only">resueltos en 7 días</span>
                </span>
                <span className="ml-auto text-tenue">7 días</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
