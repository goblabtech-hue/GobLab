import Link from 'next/link'
import { ListChecks, CircleCheck, Circle, UserRound, ArrowRight } from 'lucide-react'
import { requerirRol } from '@/infrastructure/auth'
import { planDeImplementacion, type Paso } from '@/application/implementacion'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { Imprimir } from '../manuales/imprimir'

export const metadata = { title: 'Qué sigue' }
export const dynamic = 'force-dynamic'

const QUIEN: Record<Paso['quien'], string> = { municipio: 'Municipio', demoscopia: 'Demoscopia', ambos: 'Ambos' }

function Estado({ p }: { p: Paso }) {
  if (p.estado === 'hecho') return <span className="inline-flex items-center gap-1 text-xs font-medium text-verde-600"><CircleCheck className="size-4" aria-hidden />Hecho</span>
  if (p.estado === 'pendiente') return <span className="inline-flex items-center gap-1 text-xs font-medium text-ambar-600"><Circle className="size-4" aria-hidden />Pendiente</span>
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-tinta-suave"><UserRound className="size-4" aria-hidden />Lo confirma una persona</span>
}

/**
 * La lista de implementación. Se revisa sola contra la base y la
 * configuración; lo que no puede comprobar lo dice. Sirve como agenda de la
 * primera reunión con un municipio y como tablero de avance después.
 */
export default async function QueSigue() {
  await requerirRol('admin')
  const plan = await planDeImplementacion()
  const avance = plan.total ? Math.round((plan.hechos / plan.total) * 100) : 0

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <ListChecks className="size-5 text-marca-600" aria-hidden />
            Qué sigue para implementarlo en un municipio
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Los pasos en el orden real de una implantación. Los que el sistema puede comprobar
            se marcan solos con lo que encontró; los demás los confirma una persona. Es la
            agenda de la primera reunión y el tablero de avance después.
          </p>
        </div>
        <Imprimir />
      </div>

      <Tarjeta><TarjetaCuerpo className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-sm text-tinta-suave">Comprobado por el sistema</p>
          <p className="text-3xl font-semibold tabular-nums">{plan.hechos} <span className="text-base font-normal text-tinta-suave">de {plan.hechos + plan.pendientes}</span></p>
        </div>
        <div className="min-w-48 flex-1">
          <div className="h-2.5 overflow-hidden rounded-full bg-lienzo" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-marca-600" style={{ width: `${plan.hechos + plan.pendientes ? Math.round((plan.hechos / (plan.hechos + plan.pendientes)) * 100) : 0}%` }} />
          </div>
          <p className="mt-1 text-xs text-tenue">{plan.pendientes} pendientes comprobables · {plan.total - plan.hechos - plan.pendientes} que confirma una persona</p>
        </div>
      </TarjetaCuerpo></Tarjeta>

      <nav aria-label="Fases" className="print:hidden">
        <ul className="flex flex-wrap gap-2">
          {plan.fases.map((f) => (
            <li key={f.id}><a href={`#${f.id}`} className="inline-flex h-9 items-center rounded-lg border border-borde bg-papel px-3 text-sm hover:border-marca-300">{f.titulo}</a></li>
          ))}
        </ul>
      </nav>

      {plan.fases.map((f) => (
        <section key={f.id} id={f.id} className="scroll-mt-20 space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{f.titulo}</h2>
            <p className="text-sm text-tinta-suave">{f.para}</p>
          </div>
          <ol className="space-y-2">
            {f.pasos.map((p) => (
              <li key={p.id}>
                <Tarjeta className={p.estado === 'hecho' ? 'border-verde-600/20' : undefined}>
                  <TarjetaCuerpo className="flex flex-wrap gap-x-6 gap-y-2 p-4 sm:flex-nowrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{p.titulo}</h3>
                        <Insignia>{QUIEN[p.quien]}</Insignia>
                      </div>
                      <p className="mt-1 text-sm text-tinta-suave">{p.que}</p>
                      <p className="mt-1.5 text-xs text-tenue">{p.detalle}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <Estado p={p} />
                      {p.href && (
                        <Link href={p.href} className="inline-flex items-center gap-1 text-xs text-marca-700 underline print:hidden">
                          {p.href.startsWith('/admin') ? 'Configurar' : 'Abrir'}<ArrowRight className="size-3" aria-hidden />
                        </Link>
                      )}
                    </div>
                  </TarjetaCuerpo>
                </Tarjeta>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <p className="text-xs text-tenue">
        La guía técnica del servidor está en <code>DESPLIEGUE.md</code>; la de las tiendas en <code>TIENDAS.md</code>; el detalle de cada pendiente en <code>PENDIENTES.md</code>.
      </p>
    </div>
  )
}
