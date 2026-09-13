'use client'

import Link from 'next/link'
import { useOptimistic, useState, useTransition } from 'react'
import { ArrowRight } from 'lucide-react'
import { catalogoPorArea, type CategoriaMaestra } from '@/domain/catalogo-categorias'
import { IconoCategoria } from '@/components/icono-categoria'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Alerta } from '@/components/ui/alerta'
import { alternarCategoriaCatalogo } from '../acciones'

/**
 * El catálogo maestro con una casilla por problema.
 *
 * Marcar activa el problema: aparece en /reportar, en el menú del bot y en
 * /admin/plazos para afinar su promesa. Desmarcar lo esconde sin borrar nada
 * —los reportes que ya existen de esa categoría siguen ahí.
 */
export function CatalogoMaestro({ activos }: { activos: string[] }) {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [activosReales, setActivosReales] = useState(new Set(activos))
  // Optimista: la casilla responde al toque, no un segundo después.
  const [optimista, marcar] = useOptimistic(
    activosReales,
    (estado, cambio: { slug: string; activa: boolean }) => {
      const s = new Set(estado)
      if (cambio.activa) s.add(cambio.slug); else s.delete(cambio.slug)
      return s
    },
  )

  const alternar = (c: CategoriaMaestra) => {
    const activa = !optimista.has(c.slug)
    setError(null)
    empezar(async () => {
      marcar({ slug: c.slug, activa })
      const r = await alternarCategoriaCatalogo(c.slug, activa)
      if (r.error) {
        setError(r.error)
        return
      }
      setActivosReales((prev) => {
        const s = new Set(prev)
        if (activa) s.add(c.slug); else s.delete(c.slug)
        return s
      })
    })
  }

  const grupos = catalogoPorArea()
  const total = grupos.reduce((a, g) => a + g.categorias.length, 0)

  return (
    <Tarjeta>
      <TarjetaCuerpo className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Catálogo de problemas</h2>
            <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
              {total} problemas que atienden los municipios, por área. Marca los que aplican en el
              tuyo: aparecen en la página de reportar, en el bot y en la pantalla de plazos con un
              plazo sugerido que puedes ajustar. Desmarcar esconde sin borrar.
            </p>
          </div>
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{optimista.size}</span>
            <span className="text-tinta-suave"> activos · </span>
            <Link href="/admin/plazos" className="inline-flex items-center gap-1 text-marca-700 underline-offset-2 hover:underline">
              configurar plazos <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </p>
        </div>

        {error && <Alerta tipo="error">{error}</Alerta>}

        <div className="grid gap-5 md:grid-cols-2">
          {grupos.map((g) => (
            <fieldset key={g.area} className="min-w-0">
              <legend className="mb-2 text-xs font-medium tracking-wide text-tinta-suave uppercase">
                {g.nombre}
              </legend>
              <ul className="space-y-1">
                {g.categorias.map((c) => {
                  const activa = optimista.has(c.slug)
                  return (
                    <li key={c.slug}>
                      <label
                        className={[
                          'flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-lienzo',
                          activa ? '' : 'text-tinta-suave',
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          checked={activa}
                          disabled={pendiente}
                          onChange={() => alternar(c)}
                          className="mt-1 size-4 shrink-0 accent-[--color-marca-600]"
                        />
                        <IconoCategoria nombre={c.icono} className="mt-0.5 size-4 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug">{c.nombre}</span>
                          <span className="block text-xs text-tenue">
                            {c.descripcion} · <span className="tabular-nums">{c.sla} días hábiles</span>
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          ))}
        </div>
      </TarjetaCuerpo>
    </Tarjeta>
  )
}
