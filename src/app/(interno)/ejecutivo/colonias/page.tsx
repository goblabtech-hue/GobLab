import Link from 'next/link'
import { MapPinned, AlertTriangle } from 'lucide-react'
import { requerirRol } from '@/infrastructure/auth'
import { informeColonias, type PeriodoColonias } from '@/application/informe-colonias'
import { numero } from '@/domain/formato'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { Alerta } from '@/components/ui/alerta'
import { SelloDependencia } from '@/components/sello-dependencia'

export const metadata = { title: 'Por colonia' }
export const dynamic = 'force-dynamic'

const PERIODOS: { dias: PeriodoColonias; texto: string }[] = [
  { dias: 30, texto: 'Último mes' }, { dias: 90, texto: 'Últimos 3 meses' }, { dias: 365, texto: 'Último año' },
]

/**
 * Dónde están los problemas. Las colonias ordenadas por lo que tienen
 * abierto hoy; el periodo solo cambia qué se cuenta como «llegaron».
 */
export default async function PorColonia({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const usuario = await requerirRol('supervisor', 'admin')
  const sp = await searchParams
  const periodo = (PERIODOS.find((p) => String(p.dias) === sp.periodo)?.dias ?? 90) as PeriodoColonias
  const alcance = usuario.rol === 'supervisor' ? usuario.dependenciaId ?? null : null
  const inf = await informeColonias(periodo, alcance)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <MapPinned className="size-5 text-marca-600" aria-hidden />
            Dónde están los problemas
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
            Las colonias con más reportes abiertos hoy, primero. {alcance ? 'Solo lo de tu área.' : 'De todas las áreas.'}{' '}
            «Llegaron» y «resueltos» cuentan el periodo elegido; «abiertos» y «vencidos» son lo que está pendiente ahora, sea de cuándo sea.
          </p>
        </div>
        <nav className="flex gap-1 rounded-lg border border-borde bg-papel p-1" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <Link key={p.dias} href={`/ejecutivo/colonias?periodo=${p.dias}`}
              aria-current={p.dias === periodo ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm ${p.dias === periodo ? 'bg-marca-600 font-medium text-white' : 'hover:bg-lienzo'}`}>
              {p.texto}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { t: 'Colonias con pendientes', v: inf.totales.conAbiertos, pie: `de ${numero(inf.totales.colonias)} en el catálogo` },
          { t: 'Abiertos', v: inf.totales.abiertos, pie: 'con colonia identificada' },
          { t: 'Vencidos', v: inf.totales.vencidos, pie: 'pasaron su plazo', rojo: inf.totales.vencidos > 0 },
          { t: 'Llegaron', v: inf.totales.recibidos, pie: PERIODOS.find((p) => p.dias === periodo)!.texto.toLowerCase() },
        ].map((c) => (
          <Tarjeta key={c.t}><TarjetaCuerpo className="p-4">
            <p className="text-sm text-tinta-suave">{c.t}</p>
            <p className={`mt-1 text-3xl font-semibold tabular-nums ${c.rojo ? 'text-rojo-600' : ''}`}>{numero(c.v)}</p>
            <p className="text-xs text-tenue">{c.pie}</p>
          </TarjetaCuerpo></Tarjeta>
        ))}
      </div>

      {inf.sinColonia.abiertos > 0 && (
        <Alerta tipo="aviso">
          {numero(inf.sinColonia.abiertos)} reportes abiertos no tienen colonia (llegaron solo con coordenadas o sin ubicación) y no aparecen aquí.{' '}
          <Link href="/bandeja?estatus=abiertos" className="underline">Están en la bandeja.</Link>
        </Alerta>
      )}

      {inf.filas.length === 0 ? (
        <Alerta tipo="exito">Ninguna colonia tiene reportes abiertos ni recibió reportes en el periodo.</Alerta>
      ) : (
        <Tarjeta className="overflow-hidden"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-lienzo text-left text-xs tracking-wide text-tinta-suave uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Colonia</th>
                <th className="px-4 py-2.5 font-medium">Abiertos</th>
                <th className="px-4 py-2.5 font-medium">Vencidos</th>
                <th className="px-4 py-2.5 font-medium">Llegaron</th>
                <th className="px-4 py-2.5 font-medium">Resueltos</th>
                <th className="px-4 py-2.5 font-medium">Problema principal</th>
                <th className="px-4 py-2.5 font-medium">Áreas con pendientes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {inf.filas.map((f, i) => (
                <tr key={f.id} className={f.vencidos > 0 ? 'bg-rojo-50/30' : undefined}>
                  <td className="px-4 py-2.5 text-tenue tabular-nums">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/ejecutivo/colonias/${f.id}?periodo=${periodo}`} className="font-medium text-marca-700 underline decoration-marca-300 hover:decoration-marca-700">{f.nombre}</Link>
                    <p className="text-xs text-tinta-suave">{[f.tipo, f.codigoPostal ? `CP ${f.codigoPostal}` : null].filter(Boolean).join(' · ')}</p>
                  </td>
                  <td className="px-4 py-2.5 text-lg font-semibold tabular-nums">{numero(f.abiertos)}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {f.vencidos > 0 ? <Insignia tono="rojo"><AlertTriangle className="size-3" aria-hidden />{numero(f.vencidos)}</Insignia> : <span className="text-tenue">0</span>}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{numero(f.recibidos)}{f.reabiertos > 0 && <span className="ml-1 text-xs text-ambar-600">({f.reabiertos} reabiertos)</span>}</td>
                  <td className="px-4 py-2.5 tabular-nums">{numero(f.resueltos)}</td>
                  <td className="px-4 py-2.5">{f.principal ? <>{f.principal.nombre} <span className="text-xs text-tinta-suave">×{f.principal.total}</span></> : <span className="text-tenue">—</span>}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {f.areas.map((a) => (
                        <span key={a.id} className="inline-flex items-center gap-1 text-xs" title={a.nombre}>
                          <SelloDependencia dependencia={a} /><span className="tabular-nums">{a.abiertos}</span>
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></Tarjeta>
      )}
    </div>
  )
}
