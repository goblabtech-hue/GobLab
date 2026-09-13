import Link from 'next/link'
import { CheckCircle2, MapPin, XCircle } from 'lucide-react'
import { prisma } from '@/infrastructure/prisma'
import { requerirRol } from '@/infrastructure/auth'
import { semaforo } from '@/domain/dias-habiles'
import { cargarFestivos } from '@/infrastructure/festivos'
import { ESTATUS, ESTATUS_ABIERTOS, PRIORIDAD, SEMAFORO } from '@/domain/presentacion'
import { fecha, haceCuanto, numero } from '@/domain/formato'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { IconoCategoria } from '@/components/icono-categoria'
import { ResponsableReporte } from '@/components/responsable-reporte'
import { SelloDependencia } from '@/components/sello-dependencia'
import { descifrarTelefono } from '@/domain/telefono'

export const metadata = { title: 'Mis reportes' }
export const dynamic = 'force-dynamic'

/**
 * Vista de cuadrilla (SPEC §4.3): "Mis reportes de hoy", ordenada por
 * vencimiento. Es la única pantalla del sistema pensada para usarse de pie en
 * la calle y con una mano, así que va sin tabla y con objetivos táctiles grandes.
 */
export default async function PaginaCuadrilla({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const usuario = await requerirRol('cuadrilla', 'supervisor', 'admin')
  const { ver } = await searchParams
  const verRechazados = ver === 'rechazados'

  const mios = usuario.rol === 'cuadrilla'
    ? { asignadoAId: usuario.id }
    : usuario.dependenciaId ? { dependenciaId: usuario.dependenciaId } : {}

  // Los rechazados: lo que recepción no registró o la bandeja marcó
  // improcedente. Se muestran aparte porque no son trabajo pendiente, pero
  // conviene poder revisar qué se descartó y por qué. Una cuadrilla no los
  // ve: nunca fueron suyos.
  const rechazados = verRechazados && usuario.rol !== 'cuadrilla'
    ? await prisma.reporte.findMany({
        where: { ...mios, estatus: 'improcedente' },
        orderBy: [{ updatedAt: 'desc' }], take: 100,
        select: {
          id: true, folio: true, descripcion: true, motivoImprocedente: true, updatedAt: true, createdAt: true, moderadoPorId: true,
          categoria: { select: { nombre: true, icono: true } },
          colonia: { select: { nombre: true } },
          dependencia: { select: { nombre: true, icono: true, color: true } },
          eventos: { where: { tipo: 'improcedente' }, orderBy: { timestamp: 'desc' }, take: 1, select: { timestamp: true, usuario: { select: { nombre: true } } } },
        },
      })
    : []
  const totalRechazados = usuario.rol === 'cuadrilla' ? 0 : await prisma.reporte.count({ where: { ...mios, estatus: 'improcedente' } })

  const [reportes, festivos, resueltosHoy] = await Promise.all([
    prisma.reporte.findMany({
      where: { ...mios, estatus: { in: ESTATUS_ABIERTOS } },
      orderBy: [{ fechaLimite: 'asc' }],
      select: {
        id: true, folio: true, descripcion: true, estatus: true, prioridad: true,
        fechaLimite: true, direccionTexto: true,
        categoria: { select: { nombre: true, icono: true } },
        colonia: { select: { nombre: true } },
        dependencia: { select: { nombre: true, icono: true, color: true } },
        asignadoA: { select: { id: true, nombre: true, telefonoCifrado: true } },
      },
    }),
    cargarFestivos(),
    prisma.reporte.count({
      where: {
        ...(usuario.rol === 'cuadrilla' ? { asignadoAId: usuario.id } : mios),
        resueltoAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ])

  const vencidos = reportes.filter((r) => semaforo(r.fechaLimite, festivos) === 'rojo')

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Mis reportes</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {verRechazados
              ? `${numero(totalRechazados)} rechazados: no se registraron o se marcaron improcedentes.`
              : <>
                  {reportes.length === 0
                    ? 'No tienes reportes pendientes. Buen trabajo.'
                    : `${numero(reportes.length)} pendientes, ordenados por el que vence primero.`}
                  {vencidos.length > 0 && ` ${vencidos.length} ya vencieron.`}
                </>}
          </p>
        </div>
        {usuario.rol !== 'cuadrilla' && (
          <nav className="flex gap-1 rounded-lg border border-borde bg-papel p-1 text-sm" aria-label="Qué ver">
            <Link href="/cuadrilla" aria-current={!verRechazados ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 ${!verRechazados ? 'bg-marca-600 font-medium text-white' : 'hover:bg-lienzo'}`}>
              Pendientes
            </Link>
            <Link href="/cuadrilla?ver=rechazados" aria-current={verRechazados ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 ${verRechazados ? 'bg-marca-600 font-medium text-white' : 'hover:bg-lienzo'}`}>
              Rechazados{totalRechazados > 0 && <span className="ml-1 tabular-nums opacity-80">{numero(totalRechazados)}</span>}
            </Link>
          </nav>
        )}
      </div>

      {verRechazados && (
        <ul className="space-y-3">
          {rechazados.length === 0 && <li className="text-sm text-tinta-suave">No hay reportes rechazados.</li>}
          {rechazados.map((r) => {
            const ev = r.eventos[0]
            return (
              <li key={r.id}>
                <Link href={`/bandeja/${r.folio}`} className="block">
                  <Tarjeta className="transition-colors hover:bg-lienzo/60">
                    <TarjetaCuerpo className="flex gap-3">
                      <IconoCategoria nombre={r.categoria.icono} className="mt-0.5 size-6 shrink-0 text-tenue" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold">{r.categoria.nombre}</p>
                          <Insignia tono="neutro"><XCircle className="size-3" aria-hidden />Rechazado</Insignia>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-tinta-suave">{r.descripcion}</p>
                        <p className="mt-2 rounded-lg bg-lienzo p-2.5 text-sm">
                          <span className="font-medium">Motivo: </span>{r.motivoImprocedente ?? 'Sin motivo registrado'}
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-tenue">
                          <span className="flex items-center gap-1"><SelloDependencia dependencia={r.dependencia} />{r.dependencia.nombre}</span>
                          <span>· {r.folio}</span>
                          {r.colonia && <span>· Col. {r.colonia.nombre}</span>}
                          <span>· rechazado {ev?.usuario?.nombre ? `por ${ev.usuario.nombre} ` : ''}{haceCuanto(ev?.timestamp ?? r.updatedAt)}</span>
                        </p>
                      </div>
                    </TarjetaCuerpo>
                  </Tarjeta>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {!verRechazados && resueltosHoy > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-verde-50 p-3 text-sm text-verde-600">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          Hoy has resuelto {resueltosHoy} {resueltosHoy === 1 ? 'reporte' : 'reportes'}.
        </p>
      )}

      {!verRechazados && <ul className="space-y-3">
        {reportes.map((r) => {
          const luz = semaforo(r.fechaLimite, festivos)
          return (
            <li key={r.id}>
              <Link href={`/cuadrilla/${r.folio}`} className="block">
                <Tarjeta className={`transition-colors hover:bg-lienzo/60 ${luz === 'rojo' ? 'border-rojo-600/30' : ''}`}>
                  <TarjetaCuerpo className="flex gap-3">
                    <IconoCategoria nombre={r.categoria.icono} className="mt-0.5 size-6 shrink-0 text-marca-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold">{r.categoria.nombre}</p>
                        <div className="flex gap-1.5">
                          {r.prioridad !== 'normal' && (
                            <Insignia tono={PRIORIDAD[r.prioridad].tono}>{PRIORIDAD[r.prioridad].texto}</Insignia>
                          )}
                          <Insignia tono={SEMAFORO[luz].tono}>{SEMAFORO[luz].texto}</Insignia>
                        </div>
                      </div>

                      <p className="mt-1 line-clamp-2 text-sm text-tinta-suave">{r.descripcion}</p>

                      <p className="mt-1.5 flex items-start gap-1.5 text-sm text-tinta-suave">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span>
                          {r.direccionTexto ?? 'Sin dirección'}
                          {r.colonia && !r.direccionTexto?.includes(r.colonia.nombre) && ` · Col. ${r.colonia.nombre}`}
                        </span>
                      </p>

                      <ResponsableReporte
                        className="mt-2 border-t border-borde pt-2"
                        dependencia={r.dependencia}
                        persona={r.asignadoA ? { nombre: r.asignadoA.nombre, telefono: r.asignadoA.telefonoCifrado ? descifrarTelefono(r.asignadoA.telefonoCifrado) : null } : null}
                        esUsuarioActual={r.asignadoA?.id === usuario.id}
                        enlaceTelefono={false}
                      />

                      <p className="mt-1.5 text-xs text-tenue">
                        {r.folio} · {ESTATUS[r.estatus].interno} · vence {fecha(r.fechaLimite)}
                      </p>
                    </div>
                  </TarjetaCuerpo>
                </Tarjeta>
              </Link>
            </li>
          )
        })}
      </ul>}
    </div>
  )
}
