import Link from 'next/link'
import { CheckCircle2, MapPin } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requerirRol } from '@/lib/auth'
import { cargarFestivos, semaforo } from '@/lib/sla'
import { ESTATUS, ESTATUS_ABIERTOS, PRIORIDAD, SEMAFORO } from '@/lib/presentacion'
import { fecha, numero } from '@/lib/utils'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { IconoCategoria } from '@/components/icono-categoria'

export const metadata = { title: 'Mis reportes' }
export const dynamic = 'force-dynamic'

/**
 * Vista de cuadrilla (SPEC §4.3): "Mis reportes de hoy", ordenada por
 * vencimiento. Es la única pantalla del sistema pensada para usarse de pie en
 * la calle y con una mano, así que va sin tabla y con objetivos táctiles grandes.
 */
export default async function PaginaCuadrilla() {
  const usuario = await requerirRol('cuadrilla', 'supervisor', 'admin')

  const mios = usuario.rol === 'cuadrilla'
    ? { asignadoAId: usuario.id }
    : usuario.dependenciaId ? { dependenciaId: usuario.dependenciaId } : {}

  const [reportes, festivos, resueltosHoy] = await Promise.all([
    prisma.reporte.findMany({
      where: { ...mios, estatus: { in: ESTATUS_ABIERTOS } },
      orderBy: [{ fechaLimite: 'asc' }],
      select: {
        id: true, folio: true, descripcion: true, estatus: true, prioridad: true,
        fechaLimite: true, direccionTexto: true,
        categoria: { select: { nombre: true, icono: true } },
        colonia: { select: { nombre: true } },
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
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Mis reportes</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          {reportes.length === 0
            ? 'No tienes reportes pendientes. Buen trabajo.'
            : `${numero(reportes.length)} pendientes, ordenados por el que vence primero.`}
          {vencidos.length > 0 && ` ${vencidos.length} ya vencieron.`}
        </p>
      </div>

      {resueltosHoy > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-verde-50 p-3 text-sm text-verde-600">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          Hoy has resuelto {resueltosHoy} {resueltosHoy === 1 ? 'reporte' : 'reportes'}.
        </p>
      )}

      <ul className="space-y-3">
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
                          {r.colonia && ` · Col. ${r.colonia.nombre}`}
                        </span>
                      </p>

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
      </ul>
    </div>
  )
}
