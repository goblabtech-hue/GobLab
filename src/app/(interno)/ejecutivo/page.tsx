import Link from 'next/link'
import { AlertTriangle, Bot, Building2, RotateCcw, Users } from 'lucide-react'
import { requerirRol } from '@/lib/auth'
import { obtenerIndicadores } from '@/lib/indicadores'
import { calcularIndicadoresInternos, HORAS_A_TEXTO } from '@/lib/indicadores-internos'
import { alertasActivas } from '@/lib/alertas'
import { fechaHora, numero, pct } from '@/lib/utils'
import { Tarjeta, TarjetaCuerpo, TarjetaTitulo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { Alerta } from '@/components/ui/alerta'
import { Cifra } from '@/components/tablero/cifra'

export const metadata = { title: 'Indicadores' }
export const dynamic = 'force-dynamic'

const TITULO_ALERTA: Record<string, string> = {
  vencidos_sobre_umbral: 'Demasiados reportes vencidos',
  caida_calificacion: 'Cayó la calificación ciudadana',
  reaperturas_categoria: 'Se están reabriendo muchos reportes',
}

/** Verde ≥90%, ámbar 70–89%, rojo <70%. */
function tono(p: number | null) {
  if (p === null) return 'neutro' as const
  if (p >= 90) return 'verde' as const
  if (p >= 70) return 'ambar' as const
  return 'rojo' as const
}

export default async function Ejecutivo() {
  await requerirRol('supervisor', 'admin')

  const [publicos, internos, alertas] = await Promise.all([
    obtenerIndicadores(),
    calcularIndicadoresInternos(),
    alertasActivas(),
  ])

  const cuadrillasConTrabajo = internos.cuadrillas.filter(
    (c) => c.resueltos > 0 || c.asignadosAbiertos > 0,
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Indicadores</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Últimos 12 meses. Lo público está en{' '}
            <Link href="/tablero" className="text-marca-700 underline">el tablero abierto</Link>;
            aquí va además el desglose interno.
          </p>
        </div>
        <p className="text-xs text-tenue">Actualizado {fechaHora(publicos.generadoAt)}</p>
      </div>

      {/* ------------------------------------------------ alertas */}
      <section aria-labelledby="alertas">
        <h2 id="alertas" className="sr-only">Alertas</h2>
        {alertas.length === 0 ? (
          <Alerta tipo="exito" titulo="Sin alertas activas">
            Ninguno de los umbrales de degradación está rebasado ahora mismo.
          </Alerta>
        ) : (
          <ul className="space-y-2">
            {alertas.map((a) => (
              <li key={a.id}>
                <Alerta tipo="error" titulo={TITULO_ALERTA[a.tipo] ?? a.tipo}>
                  {a.mensaje}
                  <span className="mt-1 block text-xs text-tenue">
                    Detectada {fechaHora(a.createdAt)}. Se cierra sola cuando la
                    condición deje de cumplirse.
                  </span>
                </Alerta>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------ resumen */}
      <section aria-labelledby="resumen">
        <h2 id="resumen" className="mb-3 text-lg font-semibold">Resumen</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Cifra titulo="Reportes recibidos" dato={publicos.resumen.recibidos} formato={numero} />
          <Cifra titulo="Resueltos a tiempo" dato={publicos.resumen.cumplimiento} formato={(n) => pct(n, 1)} />
          <Cifra titulo="Calificación ciudadana" dato={publicos.resumen.calificacion} formato={(n) => (n ? n.toFixed(2) : '—')} pie="de 5 estrellas" />
          <Tarjeta>
            <TarjetaCuerpo className="p-4">
              <p className="text-sm text-tinta-suave">Primera respuesta</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {HORAS_A_TEXTO(internos.primeraRespuestaGlobalHoras)}
              </p>
              <p className="text-xs text-tenue">del alta al primer movimiento</p>
            </TarjetaCuerpo>
          </Tarjeta>
        </div>
      </section>

      {/* ------------------------------------------------ dependencias */}
      <section aria-labelledby="dependencias">
        <h2 id="dependencias" className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <Building2 className="size-5 text-tinta-suave" aria-hidden />
          Por dependencia
        </h2>
        <p className="mb-3 text-sm text-tinta-suave">
          «Recibidos de otra área» cuenta los reportes que otra dependencia le
          pasó: si un área recibe muchos, el problema suele estar en cómo se
          clasifican al entrar, no en ella.
        </p>

        <Tarjeta className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lienzo text-left text-xs tracking-wide text-tinta-suave uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Dependencia</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Abiertos</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Vencidos</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Resueltos</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Cumple</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Tarda</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">1ª respuesta</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Recibidos de otra área</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {internos.dependencias.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 font-medium">{d.nombre}</td>
                    <td className="px-4 py-3 tabular-nums">{numero(d.abiertos)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {d.vencidos > 0
                        ? <Insignia tono="rojo">{numero(d.vencidos)}</Insignia>
                        : <span className="text-tenue">0</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{numero(d.resueltos)}</td>
                    <td className="px-4 py-3">
                      {d.cumplimiento === null
                        ? <span className="text-tenue">—</span>
                        : <Insignia tono={tono(d.cumplimiento)}>{pct(d.cumplimiento)}</Insignia>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.diasPromedio === null ? '—' : `${d.diasPromedio.toFixed(1)} días`}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{HORAS_A_TEXTO(d.primeraRespuestaHoras)}</td>
                    <td className="px-4 py-3 tabular-nums">{numero(d.reasignadosRecibidos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      </section>

      {/* ------------------------------------------------ cuadrillas */}
      <section aria-labelledby="cuadrillas">
        <h2 id="cuadrillas" className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <Users className="size-5 text-tinta-suave" aria-hidden />
          Por cuadrilla
        </h2>

        <Alerta tipo="aviso" className="mb-3">
          Estas cifras miden a personas con nombre y apellido, y no dicen nada
          del contexto: una cuadrilla con casos difíciles o con menos material
          va a salir peor que otra con trabajo sencillo. Úsalas para saber dónde
          hace falta apoyo, no para calificar a nadie.
        </Alerta>

        <Tarjeta className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lienzo text-left text-xs tracking-wide text-tinta-suave uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Persona</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Pendientes</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Resueltos</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">A tiempo</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Tarda</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Reabiertos</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Califican</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {cuadrillasConTrabajo.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.nombre}</p>
                      {c.dependencia && <p className="text-xs text-tinta-suave">{c.dependencia}</p>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{numero(c.asignadosAbiertos)}</td>
                    <td className="px-4 py-3 tabular-nums">{numero(c.resueltos)}</td>
                    <td className="px-4 py-3">
                      {c.cumplimiento === null
                        ? <span className="text-tenue">—</span>
                        : <Insignia tono={tono(c.cumplimiento)}>{pct(c.cumplimiento)}</Insignia>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {c.diasPromedio === null ? '—' : `${c.diasPromedio.toFixed(1)} días`}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {c.reabiertos > 0
                        ? <Insignia tono="ambar">{numero(c.reabiertos)}</Insignia>
                        : <span className="text-tenue">0</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {c.calificacionPromedio === null ? '—' : `${c.calificacionPromedio.toFixed(2)} ★`}
                    </td>
                  </tr>
                ))}
                {cuadrillasConTrabajo.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-tinta-suave">
                      Todavía no hay reportes asignados a ninguna cuadrilla.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      </section>

      {/* ------------------------------------------------ bot */}
      <section aria-labelledby="bot">
        <h2 id="bot" className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <Bot className="size-5 text-tinta-suave" aria-hidden />
          Cómo va el bot
        </h2>
        <p className="mb-3 text-sm text-tinta-suave">
          De cada conversación que empieza, cuántas terminan en un reporte y
          cuántas hay que pasarle a una persona.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Recuadro titulo="Conversaciones" valor={numero(internos.bot.conversaciones)} pie="iniciadas en el periodo" />
          <Recuadro
            titulo="Terminaron en reporte" valor={pct(internos.bot.efectividad, 1)}
            pie={`${numero(internos.bot.conReporte)} de ${numero(internos.bot.conversaciones)}`}
          />
          <Recuadro
            titulo="Pasaron a una persona" valor={pct(internos.bot.tasaEscalamiento, 1)}
            pie={`${numero(internos.bot.escaladas)} conversaciones`}
          />
          <Recuadro
            titulo="Sin clasificar por IA"
            valor={internos.bot.clasificacionesIA
              ? pct((internos.bot.usoFallback / internos.bot.clasificacionesIA) * 100, 1)
              : '—'}
            pie="cayeron al menú de respaldo"
          />
        </div>

        {internos.bot.emergenciasDetectadas > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-ambar-600">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {numero(internos.bot.emergenciasDetectadas)} conversaciones se
            derivaron por posible emergencia.
          </p>
        )}
      </section>

      {/* ------------------------------------------------ reaperturas */}
      {internos.reaperturasPorCategoria.length > 0 && (
        <section aria-labelledby="reaperturas">
          <h2 id="reaperturas" className="mb-1 flex items-center gap-2 text-lg font-semibold">
            <RotateCcw className="size-5 text-tinta-suave" aria-hidden />
            Reaperturas por tipo de problema
          </h2>
          <p className="mb-3 text-sm text-tinta-suave">
            Un reporte reabierto es un cierre que no resolvió nada. Es la señal
            más directa de trabajo mal hecho o mal verificado.
          </p>

          <Tarjeta className="overflow-hidden">
            <ul className="divide-y divide-borde">
              {internos.reaperturasPorCategoria.map((r) => (
                <li key={r.categoria} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 text-sm font-medium">{r.categoria}</span>
                  <Insignia tono={r.total >= 3 ? 'rojo' : 'neutro'}>{numero(r.total)}</Insignia>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </section>
      )}
    </div>
  )
}

function Recuadro({ titulo, valor, pie }: { titulo: string; valor: string; pie: string }) {
  return (
    <Tarjeta>
      <TarjetaCuerpo className="p-4">
        <TarjetaTitulo className="text-sm font-normal text-tinta-suave">{titulo}</TarjetaTitulo>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
        <p className="text-xs text-tenue">{pie}</p>
      </TarjetaCuerpo>
    </Tarjeta>
  )
}
