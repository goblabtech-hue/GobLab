import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requerirRol } from '@/infrastructure/auth'
import { obtenerIndicadores } from '@/application/indicadores'
import { prisma } from '@/infrastructure/prisma'
import { numero, pct } from '@/domain/formato'
import { Tarjeta } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { Alerta } from '@/components/ui/alerta'
import { IconoCategoria } from '@/components/icono-categoria'
import { FilaPlazo } from './fila'

export const metadata = { title: 'Plazos de atención' }
export const dynamic = 'force-dynamic'

/**
 * Plazos de atención (SLA) del SPEC §4.4b.
 *
 * Existe aparte de `/admin/categorias` porque cambiar un plazo no es editar un
 * catálogo: es mover un compromiso público. La pantalla pone al lado de cada
 * plazo lo que el municipio está cumpliendo de verdad y cuánto tarda en
 * promedio, para que la decisión se tome con el dato enfrente y no a ojo.
 */
export default async function PaginaPlazos() {
  await requerirRol('admin')

  const [indicadores, categorias] = await Promise.all([
    obtenerIndicadores(),
    prisma.categoria.findMany({
      orderBy: { orden: 'asc' },
      select: {
        id: true, slug: true, nombre: true, icono: true, slaDiasHabiles: true,
        activa: true, dependencia: { select: { nombre: true } },
      },
    }),
  ])

  const porSlug = new Map(indicadores.promesas.map((p) => [p.slug, p]))
  const enRiesgo = indicadores.promesas.filter(
    (p) => p.cumplimiento !== null && p.cumplimiento < 70,
  )

  return (
    <div className="space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-tinta-suave hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden />
        Volver a administración
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Plazos de atención</h1>
        <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
          Cada tipo de problema tiene un plazo en días hábiles. Se publica en el
          tablero abierto y se mide contra el cumplimiento real, así que es un
          compromiso con la gente, no una meta interna.
        </p>
      </div>

      <Alerta tipo="info" titulo="Cambiar un plazo no reescribe el pasado">
        Cada reporte guarda el plazo que se le prometió el día que se levantó.
        Bajar un plazo hoy no convierte en incumplidos a los reportes que ya se
        resolvieron: el cambio solo aplica a los que entren a partir de ahora.
      </Alerta>

      {enRiesgo.length > 0 && (
        <Alerta tipo="aviso" titulo={`${enRiesgo.length} plazos se están incumpliendo más de lo que se cumplen`}>
          {enRiesgo.map((p) => p.nombre).join(', ')}. Un plazo que no se cumple
          erosiona la confianza más que uno largo y honesto: o se refuerza el
          área, o se ajusta la promesa a lo que de verdad se puede sostener.
        </Alerta>
      )}

      <Tarjeta className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-lienzo text-left text-xs tracking-wide text-tinta-suave uppercase">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Tipo de problema</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Prometemos</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Tardamos</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Cumplimos</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Resueltos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {categorias.map((c) => {
                const real = porSlug.get(c.slug)
                return (
                  <FilaPlazo
                    key={c.id}
                    categoriaId={c.id}
                    sla={c.slaDiasHabiles}
                    nombre={
                      <span className="flex items-center gap-2">
                        <IconoCategoria nombre={c.icono} className="size-4 shrink-0 text-marca-600" />
                        <span>
                          <span className="font-medium">{c.nombre}</span>
                          <span className="block text-xs text-tinta-suave">{c.dependencia.nombre}</span>
                        </span>
                        {!c.activa && <Insignia>Inactiva</Insignia>}
                      </span>
                    }
                    tardamos={real?.diasPromedio == null ? '—' : `${real.diasPromedio.toFixed(1)} días`}
                    cumplimos={
                      real?.cumplimiento == null
                        ? <span className="text-tenue">Sin datos</span>
                        : <Insignia tono={real.cumplimiento >= 90 ? 'verde' : real.cumplimiento >= 70 ? 'ambar' : 'rojo'}>
                            {pct(real.cumplimiento)}
                          </Insignia>
                    }
                    resueltos={numero(real?.resueltos ?? 0)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      <p className="text-xs text-tenue">
        «Tardamos» y «Cumplimos» son de los últimos 12 meses. Verde: se cumple
        90% o más. Ámbar: 70–89%. Rojo: menos del 70%.
      </p>
    </div>
  )
}
