import Link from 'next/link'
import { numero } from '@/domain/formato'
import type { CargaArea } from '@/application/reportes'

/**
 * Carga de trabajo por área responsable.
 *
 * Cada tarjeta lleva al listado filtrado por esa área. El número de vencidos va
 * primero en el orden porque es lo que exige acción: un área con 24 abiertos y
 * cero vencidos está al corriente; una con 8 y 5 vencidos, no.
 */
export function ResumenAreas({ areas }: { areas: CargaArea[] }) {
  if (areas.length === 0) return null

  return (
    <section aria-labelledby="areas">
      <h2 id="areas" className="mb-2 text-sm font-medium text-tinta-suave">
        Carga por área responsable
      </h2>

      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {areas.map((a) => (
          <li key={a.id}>
            <Link
              href={`/bandeja?dependencia=${a.id}&estatus=abiertos`}
              className="block h-full rounded-[--radius-tarjeta] border border-borde bg-papel p-3.5 transition-colors hover:border-marca-200 hover:bg-marca-50/40"
            >
              <p className="line-clamp-2 text-sm leading-snug font-medium">{a.nombre}</p>

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
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
