import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, Building2, CalendarRange, Inbox, Star, Users } from 'lucide-react'
import { requerirRol } from '@/infrastructure/auth'
import { panelDependencia } from '@/application/panel-dependencia'
import { ESTATUS } from '@/domain/presentacion'
import { fecha, fechaHora, haceCuanto, numero, pct } from '@/domain/formato'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { Alerta } from '@/components/ui/alerta'
import { Cifra } from '@/components/tablero/cifra'
import { GraficasArea } from '../graficas-area'

export const metadata = { title: 'Mi dependencia' }
export const dynamic = 'force-dynamic'

function tono(p: number | null) {
  if (p === null) return 'neutro' as const
  if (p >= 90) return 'verde' as const
  if (p >= 70) return 'ambar' as const
  return 'rojo' as const
}

/**
 * El tablero de una dependencia. Es lo que ve su titular al entrar: qué tiene
 * pendiente (y qué ya se venció), qué resolvió esta semana, y cómo va contra
 * el plazo que el municipio prometió. Dirección y administración pueden
 * abrir el de cualquier área; un titular solo el suyo.
 */
export default async function TableroDependencia({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirRol('supervisor', 'admin')
  const { id } = await params
  const dependenciaId = Number(id)
  if (!Number.isInteger(dependenciaId)) notFound()
  // Un titular solo ve su área. Supervisión sin dependencia es dirección: ve todas.
  if (usuario.rol === 'supervisor' && usuario.dependenciaId && usuario.dependenciaId !== dependenciaId) notFound()

  const p = await panelDependencia(dependenciaId)
  if (!p) notFound()
  const { dependencia, carga, indicadores, cuadrillas, semana, pendientes, resueltos } = p
  const esSuya = usuario.dependenciaId === dependenciaId

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-marca-700 uppercase">
            <Building2 className="size-3.5" aria-hidden />
            {esSuya ? 'Mi dependencia' : 'Dependencia'}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{dependencia.nombre}</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {dependencia.responsable ?? 'Sin titular capturado'}{dependencia.correo ? ` · ${dependencia.correo}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/bandeja" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-borde px-3 text-sm font-medium hover:bg-lienzo">
            <Inbox className="size-4" aria-hidden />Bandeja
          </Link>
          <Link href="/ejecutivo/semanal" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-borde px-3 text-sm font-medium hover:bg-lienzo">
            <CalendarRange className="size-4" aria-hidden />Informe semanal
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------ hoy */}
      <section aria-labelledby="hoy">
        <h2 id="hoy" className="mb-3 text-lg font-semibold">Hoy</h2>
        {carga.vencidos > 0 && (
          <Alerta tipo="error" titulo={`${numero(carga.vencidos)} ${carga.vencidos === 1 ? 'reporte vencido' : 'reportes vencidos'}`} className="mb-3">
            Ya pasó el plazo que el municipio prometió y siguen abiertos. Son los primeros de la lista de abajo.
          </Alerta>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: 'Abiertos', v: carga.abiertos, pie: 'en el área ahora mismo', tono: 'text-tinta' },
            { t: 'Vencidos', v: carga.vencidos, pie: 'pasaron su plazo', tono: carga.vencidos ? 'text-rojo-600' : 'text-tinta' },
            { t: 'Vencen hoy', v: carga.porVencerHoy, pie: 'todavía se pueden cumplir', tono: carga.porVencerHoy ? 'text-ambar-600' : 'text-tinta' },
            { t: 'Sin cuadrilla', v: carga.sinCuadrilla, pie: 'nadie los tiene asignados', tono: carga.sinCuadrilla ? 'text-ambar-600' : 'text-tinta' },
          ].map((c) => (
            <Tarjeta key={c.t}><TarjetaCuerpo className="p-4">
              <p className="text-sm text-tinta-suave">{c.t}</p>
              <p className={`mt-1 text-3xl font-semibold tabular-nums ${c.tono}`}>{numero(c.v)}</p>
              <p className="text-xs text-tenue">{c.pie}</p>
            </TarjetaCuerpo></Tarjeta>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ pendientes */}
      <section aria-labelledby="pendientes">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="pendientes" className="text-lg font-semibold">Lo que tiene asignado</h2>
          <Link href="/bandeja" className="text-sm text-marca-700 underline">Ver todos en la bandeja</Link>
        </div>
        {pendientes.length === 0 ? (
          <Alerta tipo="exito">Sin pendientes. Todo lo que llegó al área está resuelto.</Alerta>
        ) : (
          <Tarjeta className="overflow-hidden"><div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lienzo text-left text-xs tracking-wide text-tinta-suave uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Folio</th>
                  <th className="px-4 py-2.5 font-medium">Qué</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Quién</th>
                  <th className="px-4 py-2.5 font-medium">Plazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {pendientes.map((r) => (
                  <tr key={r.id} className={r.vencido ? 'bg-rojo-50/40' : undefined}>
                    <td className="px-4 py-2.5 whitespace-nowrap"><Link href={`/bandeja/${r.folio}`} className="font-mono text-marca-700 underline">{r.folio}</Link></td>
                    <td className="max-w-md px-4 py-2.5">
                      <p className="truncate">{r.descripcion}</p>
                      <p className="text-xs text-tinta-suave">{r.categoria}{r.colonia ? ` · ${r.colonia}` : ''} · {haceCuanto(r.createdAt)}</p>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap"><Insignia tono={ESTATUS[r.estatus as keyof typeof ESTATUS]?.tono ?? 'neutro'}>{ESTATUS[r.estatus as keyof typeof ESTATUS]?.interno ?? r.estatus}</Insignia></td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{r.asignadoA ?? <span className="text-ambar-600">Sin asignar</span>}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {r.vencido
                        ? <Insignia tono="rojo"><AlertTriangle className="size-3" aria-hidden />venció {fecha(r.fechaLimite)}</Insignia>
                        : <span>{fecha(r.fechaLimite)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></Tarjeta>
        )}
        {carga.abiertos > pendientes.length && (
          <p className="mt-2 text-xs text-tenue">Se muestran los {pendientes.length} más urgentes de {numero(carga.abiertos)}.</p>
        )}
      </section>

      {/* ------------------------------------------------ resultados */}
      <section aria-labelledby="resultados">
        <h2 id="resultados" className="mb-3 text-lg font-semibold">Resultados</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tarjeta><TarjetaCuerpo className="p-4">
            <p className="text-sm text-tinta-suave">Esta semana</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{numero(semana?.resueltos ?? 0)}</p>
            <p className="text-xs text-tenue">
              resueltos{semana && semana.resueltos > 0 ? `, ${numero(semana.aTiempo)} a tiempo` : ''}
              {semana && semana.resueltosPrevio > 0 ? ` · semana pasada: ${numero(semana.resueltosPrevio)}` : ''}
            </p>
          </TarjetaCuerpo></Tarjeta>
          <Cifra titulo="Resueltos a tiempo" dato={indicadores.resumen.cumplimiento} formato={(n) => pct(n, 1)} pie="últimos 12 meses" />
          <Cifra titulo="Resueltos" dato={indicadores.resumen.resueltos} formato={numero} pie="últimos 12 meses" />
          <Cifra titulo="Calificación de los vecinos" dato={indicadores.resumen.calificacion} formato={(n) => (n ? n.toFixed(2) : '—')} pie="de 5 estrellas" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Tarjeta className="overflow-hidden">
            <div className="border-b border-borde px-4 py-3">
              <p className="font-semibold">Últimos resueltos</p>
              <p className="text-xs text-tinta-suave">Con la calificación que dio quien reportó, si ya contestó.</p>
            </div>
            <ul className="divide-y divide-borde text-sm">
              {resueltos.length === 0 && <li className="px-4 py-3 text-tinta-suave">Todavía nada resuelto.</li>}
              {resueltos.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <Link href={`/bandeja/${r.folio}`} className="font-mono text-marca-700 underline">{r.folio}</Link>
                  <span className="min-w-0 flex-1 truncate">{r.categoria}{r.colonia ? ` · ${r.colonia}` : ''}</span>
                  <span className="text-xs text-tinta-suave">{r.porQuien ?? '—'} · {fecha(r.resueltoAt)}</span>
                  <Insignia tono={r.aTiempo ? 'verde' : 'rojo'}>{r.aTiempo ? 'a tiempo' : 'tarde'}</Insignia>
                  <span className="inline-flex w-12 items-center gap-0.5 text-xs tabular-nums">
                    {r.calificacion ? <><Star className="size-3 fill-ambar-500 text-ambar-500" aria-hidden />{r.calificacion}</> : <span className="text-tenue">sin calif.</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta className="overflow-hidden">
            <div className="border-b border-borde px-4 py-3">
              <p className="font-semibold">Cumplimiento por tipo de problema</p>
              <p className="text-xs text-tinta-suave">Contra el plazo que el municipio prometió.</p>
            </div>
            <ul className="divide-y divide-borde text-sm">
              {indicadores.promesas.filter((c) => c.resueltos > 0).map((c) => (
                <li key={c.slug} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                  <span className="text-xs text-tinta-suave whitespace-nowrap">{c.slaDiasHabiles} días · {numero(c.resueltos)} resueltos</span>
                  <Insignia tono={tono(c.cumplimiento)}>{c.cumplimiento === null ? '—' : pct(c.cumplimiento)}</Insignia>
                </li>
              ))}
              {indicadores.promesas.every((c) => c.resueltos === 0) && <li className="px-4 py-3 text-tinta-suave">Sin resueltos en el periodo.</li>}
            </ul>
          </Tarjeta>
        </div>
      </section>

      {/* ------------------------------------------------ cómo va */}
      <section aria-labelledby="comova">
        <h2 id="comova" className="mb-3 text-lg font-semibold">Cómo va</h2>
        <GraficasArea datos={indicadores} />
      </section>

      {/* ------------------------------------------------ cuadrillas */}
      <section aria-labelledby="cuadrillas">
        <h2 id="cuadrillas" className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <Users className="size-5 text-tinta-suave" aria-hidden />Su gente
        </h2>
        <p className="mb-3 text-sm text-tinta-suave">Para saber dónde hace falta apoyo, no para calificar a nadie: una cuadrilla con casos difíciles sale peor que otra con trabajo sencillo.</p>
        <Tarjeta className="overflow-hidden"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-lienzo text-left text-xs tracking-wide text-tinta-suave uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Persona</th>
                <th className="px-4 py-2.5 font-medium">Pendientes</th>
                <th className="px-4 py-2.5 font-medium">Resueltos</th>
                <th className="px-4 py-2.5 font-medium">A tiempo</th>
                <th className="px-4 py-2.5 font-medium">Tarda</th>
                <th className="px-4 py-2.5 font-medium">Califican</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {cuadrillas.length === 0 && <tr><td colSpan={6} className="px-4 py-3 text-tinta-suave">Esta dependencia no tiene cuadrillas dadas de alta. Se crean en Administración → Usuarios.</td></tr>}
              {cuadrillas.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5 font-medium">{c.nombre}</td>
                  <td className="px-4 py-2.5 tabular-nums">{numero(c.asignadosAbiertos)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{numero(c.resueltos)}</td>
                  <td className="px-4 py-2.5">{c.cumplimiento === null ? <span className="text-tenue">—</span> : <Insignia tono={tono(c.cumplimiento)}>{pct(c.cumplimiento)}</Insignia>}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{c.diasPromedio === null ? '—' : `${c.diasPromedio.toFixed(1)} días`}</td>
                  <td className="px-4 py-2.5 tabular-nums">{c.calificacionPromedio === null ? '—' : c.calificacionPromedio.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></Tarjeta>
      </section>

      <p className="text-xs text-tenue">Indicadores actualizados {fechaHora(indicadores.generadoAt)}. Mismas definiciones que el tablero público y el de dirección.</p>
    </div>
  )
}
