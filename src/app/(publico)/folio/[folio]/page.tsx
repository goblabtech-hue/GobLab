import { notFound } from 'next/navigation'
import Image from 'next/image'
import { SeguirFolioEnApp } from '@/components/seguir-folio-en-app'
import Link from 'next/link'
import { CheckCircle2, Clock, MapPin, PartyPopper, Users } from 'lucide-react'
import { prisma } from '@/infrastructure/prisma'
import { semaforo } from '@/domain/dias-habiles'
import { cargarFestivos } from '@/infrastructure/festivos'
import { ESTATUS, SEMAFORO } from '@/domain/presentacion'
import { fecha, fechaHora, haceCuanto } from '@/domain/formato'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { Alerta } from '@/components/ui/alerta'
import { IconoCategoria } from '@/components/icono-categoria'
import { LineaTiempo } from './linea-tiempo'
import { PanelCalificacion } from './calificacion'
import { FormularioAdhesion } from './adhesion'

export const dynamic = 'force-dynamic'

/**
 * Seguimiento público de un reporte.
 *
 * Regla dura (SPEC §5 y criterio 7): de aquí NO puede salir el teléfono ni el
 * nombre de quien reportó. Por eso el `select` es explícito campo por campo en
 * vez de traer el reporte completo: si mañana alguien agrega una columna
 * sensible al modelo, no se cuela sola a esta página.
 */
async function cargarReporte(folio: string) {
  return prisma.reporte.findUnique({
    where: { folio },
    select: {
      id: true, folio: true, descripcion: true, estatus: true, prioridad: true,
      createdAt: true, fechaLimite: true, resueltoAt: true, cerradoAt: true,
      calificacion: true, comentarioCalificacion: true, notaCierre: true,
      slaDiasHabilesAplicado: true,
      motivoImprocedente: true, vecesReabierto: true,
      lat: true, lng: true, direccionTexto: true,
      categoria: { select: { nombre: true, icono: true, slaDiasHabiles: true } },
      colonia: { select: { nombre: true } },
      reporteOriginal: { select: { folio: true } },
      fotos: { select: { id: true, url: true, tipo: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      eventos: {
        select: { id: true, tipo: true, timestamp: true, detalle: true },
        orderBy: { timestamp: 'asc' },
      },
      _count: { select: { adhesiones: true } },
    },
  })
}

export async function generateMetadata({ params }: PageProps<'/folio/[folio]'>) {
  const { folio } = await params
  return { title: `Reporte ${folio}` }
}

export default async function PaginaFolio({ params, searchParams }: PageProps<'/folio/[folio]'>) {
  const { folio } = await params
  const { nuevo, unido, unirme } = await searchParams

  const r = await cargarReporte(folio.toUpperCase())
  if (!r) notFound()

  const festivos = await cargarFestivos()
  const abierto = ['nuevo', 'asignado', 'en_atencion', 'reabierto'].includes(r.estatus)
  const luz = abierto ? semaforo(r.fechaLimite, festivos) : null
  const info = ESTATUS[r.estatus]

  const fotosCiudadano = r.fotos.filter((f) => f.tipo === 'ciudadano')
  const evidencias = r.fotos.filter((f) => f.tipo === 'evidencia')

  return (
    <>
    <SeguirFolioEnApp folio={r.folio} />
    <div className="mx-auto max-w-2xl px-4 py-8">
      {nuevo && (
        <Alerta tipo="exito" titulo="¡Listo! Ya tenemos tu reporte" className="mb-5">
          Guarda este folio: <strong className="font-mono">{r.folio}</strong>. Con él
          puedes volver a esta página cuando quieras.
          {' '}Nos comprometemos a atenderlo en un máximo de{' '}
          <strong>{r.slaDiasHabilesAplicado} días hábiles</strong>.
        </Alerta>
      )}
      {unido && (
        <Alerta tipo="exito" titulo="Te sumaste a este reporte" className="mb-5">
          Te avisaremos cuando se resuelva. Entre más vecinos se suman, más sube
          la prioridad.
        </Alerta>
      )}

      {/* ------------------------------------------------ encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm text-tinta-suave">{r.folio}</p>
          <h1 className="mt-0.5 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <IconoCategoria nombre={r.categoria.icono} className="size-6 shrink-0 text-marca-600" />
            {r.categoria.nombre}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Insignia tono={info.tono}>{info.ciudadano}</Insignia>
          {luz && <Insignia tono={SEMAFORO[luz].tono}>{SEMAFORO[luz].texto}</Insignia>}
        </div>
      </div>

      <p className="mt-3 text-tinta-suave">{info.explicacion}</p>

      {/* ------------------------------------------------ promesa */}
      {abierto && (
        <Tarjeta className="mt-5">
          <TarjetaCuerpo className="flex items-start gap-3">
            <Clock className="mt-0.5 size-5 shrink-0 text-marca-600" aria-hidden />
            <div>
              <p className="text-sm font-medium">Nuestra promesa para este tipo de reporte</p>
              <p className="mt-0.5 text-sm text-tinta-suave">
                {r.slaDiasHabilesAplicado} días hábiles. Para este reporte, eso vence el{' '}
                <strong>{fecha(r.fechaLimite)}</strong>.
              </p>
            </div>
          </TarjetaCuerpo>
        </Tarjeta>
      )}

      {r.estatus === 'improcedente' && r.motivoImprocedente && (
        <Alerta tipo="aviso" titulo="Este caso no lo puede atender el municipio" className="mt-5">
          {r.motivoImprocedente}
        </Alerta>
      )}

      {r.estatus === 'duplicado' && r.reporteOriginal && (
        <Alerta tipo="info" titulo="Alguien más ya había reportado esto" className="mt-5">
          Le damos seguimiento en un solo folio para no duplicar trabajo. Puedes
          verlo en{' '}
          <Link href={`/folio/${r.reporteOriginal.folio}`} className="font-mono font-semibold underline">
            {r.reporteOriginal.folio}
          </Link>.
        </Alerta>
      )}

      {/* ------------------------------------------------ qué se reportó */}
      <section className="mt-6">
        <h2 className="mb-2 text-base font-semibold">Lo que reportaste</h2>
        <Tarjeta>
          <TarjetaCuerpo className="space-y-3">
            <p className="text-pretty">{r.descripcion}</p>

            {(r.direccionTexto || r.colonia) && (
              <p className="flex items-start gap-1.5 text-sm text-tinta-suave">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {r.direccionTexto}
                  {r.direccionTexto && r.colonia && ' · '}
                  {r.colonia && `Col. ${r.colonia.nombre}`}
                </span>
              </p>
            )}

            <p className="text-sm text-tenue">
              Recibido {haceCuanto(r.createdAt)} · {fechaHora(r.createdAt)}
            </p>

            {fotosCiudadano.length > 0 && (
              <ul className="flex flex-wrap gap-2 pt-1">
                {fotosCiudadano.map((f, i) => (
                  <li key={f.id}>
                    <Image
                      src={f.url} alt={`Foto ${i + 1} del reporte`}
                      width={120} height={120} unoptimized
                      className="size-28 rounded-lg border border-borde object-cover"
                    />
                  </li>
                ))}
              </ul>
            )}
          </TarjetaCuerpo>
        </Tarjeta>
      </section>

      {/* ------------------------------------------------ vecinos sumados */}
      {r._count.adhesiones > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-tinta-suave">
          <Users className="size-4" aria-hidden />
          {r._count.adhesiones} {r._count.adhesiones === 1 ? 'vecino se sumó' : 'vecinos se sumaron'} a este reporte.
        </p>
      )}

      {/* ------------------------------------------------ evidencia */}
      {evidencias.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="size-5 text-verde-600" aria-hidden />
            Cómo quedó
          </h2>
          <Tarjeta>
            <TarjetaCuerpo className="space-y-3">
              <ul className="flex flex-wrap gap-2">
                {evidencias.map((f, i) => (
                  <li key={f.id}>
                    <Image
                      src={f.url} alt={`Evidencia ${i + 1} del trabajo terminado`}
                      width={160} height={160} unoptimized
                      className="size-36 rounded-lg border border-borde object-cover"
                    />
                  </li>
                ))}
              </ul>
              {r.notaCierre && <p className="text-sm text-tinta-suave">{r.notaCierre}</p>}
              {r.resueltoAt && (
                <p className="text-sm text-tenue">Terminado el {fechaHora(r.resueltoAt)}</p>
              )}
            </TarjetaCuerpo>
          </Tarjeta>
        </section>
      )}

      {/* ------------------------------------------------ calificación */}
      <PanelCalificacion
        folio={r.folio}
        estatus={r.estatus}
        calificacion={r.calificacion}
        comentario={r.comentarioCalificacion}
        yaSeReabrio={r.vecesReabierto > 0}
      />

      {/* ------------------------------------------------ adhesión */}
      {unirme && abierto && <FormularioAdhesion reporteId={r.id} folio={r.folio} />}

      {/* ------------------------------------------------ línea de tiempo */}
      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">Qué ha pasado con tu reporte</h2>
        <LineaTiempo eventos={r.eventos.map((e) => ({
          id: e.id, tipo: e.tipo, timestamp: e.timestamp.toISOString(),
        }))} />
      </section>

      {r.estatus === 'cerrado' && r.calificacion !== null && (
        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-tinta-suave">
          <PartyPopper className="size-4" aria-hidden />
          Gracias por ayudarnos a mejorar tu colonia.
        </p>
      )}
    </div>
    </>
  )
}
