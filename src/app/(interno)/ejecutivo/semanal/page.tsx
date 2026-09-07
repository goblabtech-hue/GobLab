import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { requerirRol } from '@/infrastructure/auth'
import { informeSemanal, type InformeDependencia } from '@/application/reportes'
import {
  etiquetaSemana, semanaAnterior, semanaDe, semanaDeClave, semanaSiguiente,
} from '@/domain/semana'
import { fechaHora, numero } from '@/domain/formato'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia, type Tono } from '@/components/ui/insignia'
import { Alerta } from '@/components/ui/alerta'

export const metadata = { title: 'Informe semanal' }
export const dynamic = 'force-dynamic'

/** Verde ≥90%, ámbar 70–89%, rojo <70%: el mismo criterio del tablero. */
function tonoCumplimiento(p: number | null): Tono {
  if (p === null) return 'neutro'
  if (p >= 90) return 'verde'
  if (p >= 70) return 'ambar'
  return 'rojo'
}

const pct1 = (n: number | null) => (n === null ? '—' : `${n.toFixed(0)}%`)

/**
 * Cómo cambió el cumplimiento contra la semana pasada.
 *
 * Se calla cuando falta alguno de los dos datos: «mejoró desde sin datos» no
 * significa nada, y una flecha inventada en un informe que se usa para evaluar
 * a la gente es peor que un espacio en blanco.
 */
function Tendencia({ hoy, antes }: { hoy: number | null; antes: number | null }) {
  if (hoy === null || antes === null) {
    return <span className="text-tenue">sin comparación</span>
  }
  const d = hoy - antes
  if (Math.abs(d) < 1) return <span className="text-tenue">igual que la semana pasada</span>
  return (
    <span className={d > 0 ? 'text-verde-600' : 'text-rojo-600'}>
      {d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(0)} puntos vs. la semana pasada
    </span>
  )
}

function Area({ d }: { d: InformeDependencia }) {
  return (
    <Tarjeta className="break-inside-avoid">
      <TarjetaCuerpo className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-tinta">{d.nombre}</h3>
            <p className="text-sm text-tinta-suave">
              {d.responsable}
              {d.correo ? ` · ${d.correo}` : ''}
            </p>
          </div>
          <Insignia tono={tonoCumplimiento(d.cumplimiento)}>
            {pct1(d.cumplimiento)} en tiempo
          </Insignia>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-tinta-suave">Resueltos</dt>
            <dd className="text-2xl font-semibold tabular-nums">{d.resueltos}</dd>
            <dd className="text-xs text-tenue">
              {d.resueltos === 0
                ? 'nada esta semana'
                : `${d.aTiempo} a tiempo, ${d.fueraDeTiempo} tarde`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-tinta-suave">Recibidos</dt>
            <dd className="text-2xl font-semibold tabular-nums">{d.recibidos}</dd>
            <dd className="text-xs text-tenue">
              {d.recibidos > d.resueltos ? 'entra más de lo que sale' : 'al corriente'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-tinta-suave">Días promedio</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {d.diasPromedio === null ? '—' : d.diasPromedio.toFixed(1)}
            </dd>
            <dd className="text-xs text-tenue">de reporte a solución</dd>
          </div>
          <div>
            <dt className="text-xs text-tinta-suave">Pendientes</dt>
            <dd className="text-2xl font-semibold tabular-nums">{d.pendientes}</dd>
            {/* En su propia línea y no junto a la cifra: «28» y «8 vencidos»
                pegados se leen como «288». */}
            <dd className={d.pendientesVencidos > 0 ? 'text-xs font-medium text-rojo-600' : 'text-xs text-tenue'}>
              {d.pendientesVencidos > 0
                ? `${d.pendientesVencidos} ya vencidos`
                : 'ninguno vencido'}
            </dd>
          </div>
        </dl>

        <p className="text-sm">
          <Tendencia hoy={d.cumplimiento} antes={d.cumplimientoPrevio} />
        </p>

        {d.masViejos.length > 0 && (
          <div className="border-t border-borde pt-3">
            <h4 className="text-sm font-medium text-tinta">Lo que lleva más tiempo esperando</h4>
            <ul className="mt-2 space-y-1.5">
              {d.masViejos.map((r) => (
                <li key={r.folio} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <Link
                    href={`/bandeja/${r.folio}`}
                    className="font-medium text-marca-700 underline underline-offset-2"
                  >
                    {r.folio}
                  </Link>
                  <span className="text-tinta-suave">{r.categoria}</span>
                  <span className="text-tenue">·</span>
                  <span className={r.diasVencido > 0 ? 'text-rojo-600' : 'text-tinta-suave'}>
                    {r.diasAbierto} días abierto
                    {r.diasVencido > 0 && `, ${r.diasVencido} vencido${r.diasVencido === 1 ? '' : 's'}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </TarjetaCuerpo>
    </Tarjeta>
  )
}

export default async function InformeSemanalPagina({ searchParams }: PageProps<'/ejecutivo/semanal'>) {
  const usuario = await requerirRol('supervisor', 'admin')
  const { semana: clave } = await searchParams

  const semana = typeof clave === 'string' ? semanaDeClave(clave) : semanaDe(new Date())
  if (!semana) notFound()

  // Un supervisor de área ve su área; un admin ve todas. Es la misma regla que
  // en la bandeja: nadie evalúa el desempeño de una dependencia ajena.
  const alcance = usuario.rol === 'admin' ? null : usuario.dependenciaId ?? null
  const informe = await informeSemanal(semana, alcance)

  const previa = semanaAnterior(semana)
  const siguiente = semanaSiguiente(semana)
  const haySiguiente = siguiente.inicio <= new Date()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:block">
        <div>
          <h1 className="text-2xl font-semibold text-tinta">Informe semanal</h1>
          <p className="mt-1 text-tinta-suave">
            Semana {etiquetaSemana(semana)}
            {informe.enCurso && (
              <Insignia tono="ambar" className="ml-2 print:hidden">en curso</Insignia>
            )}
          </p>
        </div>

        <nav className="flex items-center gap-1 print:hidden" aria-label="Cambiar de semana">
          <Link
            href={`/ejecutivo/semanal?semana=${previa.clave}`}
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-borde px-3 text-sm hover:bg-lienzo"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Anterior
          </Link>
          {haySiguiente ? (
            <Link
              href={`/ejecutivo/semanal?semana=${siguiente.clave}`}
              className="inline-flex h-10 items-center gap-1 rounded-lg border border-borde px-3 text-sm hover:bg-lienzo"
            >
              Siguiente
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center gap-1 rounded-lg border border-borde px-3 text-sm text-tenue">
              Siguiente
              <ChevronRight className="size-4" aria-hidden />
            </span>
          )}
        </nav>
      </div>

      {informe.enCurso && (
        <Alerta tipo="aviso" className="print:hidden">
          Esta semana todavía no termina: las cifras van a crecer hasta el domingo.
          Para la junta del lunes, revisa{' '}
          <Link href={`/ejecutivo/semanal?semana=${previa.clave}`} className="underline">
            la semana que acaba de cerrar
          </Link>.
        </Alerta>
      )}

      <Tarjeta>
        <TarjetaCuerpo>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { t: 'Resueltos', v: numero(informe.totales.resueltos) },
              { t: 'En tiempo', v: pct1(informe.totales.cumplimiento) },
              { t: 'Recibidos', v: numero(informe.totales.recibidos) },
              { t: 'Pendientes', v: numero(informe.totales.pendientes) },
              { t: 'Vencidos', v: numero(informe.totales.pendientesVencidos) },
            ].map(({ t, v }) => (
              <div key={t}>
                <dt className="text-sm text-tinta-suave">{t}</dt>
                <dd className="text-3xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </TarjetaCuerpo>
      </Tarjeta>

      {informe.dependencias.length === 0 ? (
        <Alerta tipo="info">
          No hay dependencias registradas. Cárgalas en{' '}
          <Link href="/admin/dependencias" className="underline">Administración → Dependencias</Link>.
        </Alerta>
      ) : (
        <div className="space-y-4">
          {informe.dependencias.map((d) => <Area key={d.id} d={d} />)}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-borde pt-4 text-sm text-tenue">
        <p>
          Generado el {fechaHora(informe.generadoEn)}. «Lo resuelto» es de esta semana;
          «lo pendiente» es el estado de hoy.
        </p>
        <p className="flex items-center gap-1.5 print:hidden">
          <Printer className="size-4" aria-hidden />
          Imprime con Ctrl/Cmd + P
        </p>
      </div>
    </div>
  )
}
