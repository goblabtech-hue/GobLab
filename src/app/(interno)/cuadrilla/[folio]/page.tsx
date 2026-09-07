import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, MapPin, Navigation } from 'lucide-react'
import { prisma } from '@/infrastructure/prisma'
import { requerirRol } from '@/infrastructure/auth'
import { semaforo } from '@/domain/dias-habiles'
import { cargarFestivos } from '@/infrastructure/festivos'
import { ESTATUS, ESTATUS_ABIERTOS, PRIORIDAD, SEMAFORO } from '@/domain/presentacion'
import { fecha, fechaHora } from '@/domain/formato'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { Alerta } from '@/components/ui/alerta'
import { FormularioResolver } from './resolver'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps<'/cuadrilla/[folio]'>) {
  const { folio } = await params
  return { title: `Reporte ${folio}` }
}

export default async function DetalleCuadrilla({ params }: PageProps<'/cuadrilla/[folio]'>) {
  await requerirRol('cuadrilla', 'supervisor', 'admin')
  const { folio } = await params

  const r = await prisma.reporte.findUnique({
    where: { folio: folio.toUpperCase() },
    select: {
      id: true, folio: true, descripcion: true, estatus: true, prioridad: true,
      fechaLimite: true, direccionTexto: true, lat: true, lng: true,
      resueltoAt: true, notaCierre: true, slaDiasHabilesAplicado: true,
      categoria: { select: { nombre: true, requiereEvidencia: true, slaDiasHabiles: true } },
      colonia: { select: { nombre: true } },
      fotos: { select: { id: true, url: true, tipo: true }, orderBy: { createdAt: 'asc' } },
      _count: { select: { adhesiones: true } },
    },
  })
  if (!r) notFound()

  const festivos = await cargarFestivos()
  const abierto = ESTATUS_ABIERTOS.includes(r.estatus)
  const luz = abierto ? semaforo(r.fechaLimite, festivos) : null

  const fotosCiudadano = r.fotos.filter((f) => f.tipo === 'ciudadano')
  const evidencias = r.fotos.filter((f) => f.tipo === 'evidencia')

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/cuadrilla" className="inline-flex items-center gap-1.5 text-sm text-tinta-suave hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden />
        Volver a mis reportes
      </Link>

      <div>
        <p className="font-mono text-sm text-tinta-suave">{r.folio}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{r.categoria.nombre}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Insignia tono={ESTATUS[r.estatus].tono}>{ESTATUS[r.estatus].interno}</Insignia>
          {r.prioridad !== 'normal' && (
            <Insignia tono={PRIORIDAD[r.prioridad].tono}>{PRIORIDAD[r.prioridad].texto}</Insignia>
          )}
          {luz && <Insignia tono={SEMAFORO[luz].tono}>{SEMAFORO[luz].texto}</Insignia>}
        </div>
      </div>

      {abierto && (
        <p className="text-sm text-tinta-suave">
          Vence el <strong>{fecha(r.fechaLimite)}</strong> ({r.slaDiasHabilesAplicado} días hábiles).
        </p>
      )}

      <Tarjeta>
        <TarjetaCuerpo className="space-y-3">
          <p className="text-pretty">{r.descripcion}</p>

          <p className="flex items-start gap-1.5 text-sm text-tinta-suave">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {r.direccionTexto ?? 'Sin dirección'}
              {r.colonia && ` · Col. ${r.colonia.nombre}`}
            </span>
          </p>

          {r.lat != null && r.lng != null && (
            <a
              href={`https://www.openstreetmap.org/directions?to=${r.lat},${r.lng}`}
              target="_blank" rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-borde px-4 text-sm font-medium hover:bg-lienzo"
            >
              <Navigation className="size-4" aria-hidden />
              Cómo llegar
            </a>
          )}

          {r._count.adhesiones > 0 && (
            <p className="text-sm text-ambar-600">
              {r._count.adhesiones} vecinos se sumaron a este reporte.
            </p>
          )}

          {fotosCiudadano.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-tinta-suave">Así lo reportó el ciudadano</p>
              <ul className="flex flex-wrap gap-2">
                {fotosCiudadano.map((f, i) => (
                  <li key={f.id}>
                    <Image src={f.url} alt={`Foto ${i + 1} del ciudadano`} width={140} height={140}
                      unoptimized className="size-32 rounded-lg border border-borde object-cover" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TarjetaCuerpo>
      </Tarjeta>

      {evidencias.length > 0 && (
        <Tarjeta>
          <TarjetaCuerpo className="space-y-2">
            <p className="text-sm font-medium">Evidencia que subiste</p>
            <ul className="flex flex-wrap gap-2">
              {evidencias.map((f, i) => (
                <li key={f.id}>
                  <Image src={f.url} alt={`Evidencia ${i + 1}`} width={140} height={140}
                    unoptimized className="size-32 rounded-lg border border-borde object-cover" />
                </li>
              ))}
            </ul>
            {r.notaCierre && <p className="text-sm text-tinta-suave">{r.notaCierre}</p>}
            {r.resueltoAt && <p className="text-xs text-tenue">Resuelto el {fechaHora(r.resueltoAt)}</p>}
          </TarjetaCuerpo>
        </Tarjeta>
      )}

      {abierto ? (
        <FormularioResolver
          reporteId={r.id}
          folio={r.folio}
          estatus={r.estatus}
          requiereEvidencia={r.categoria.requiereEvidencia}
        />
      ) : (
        <Alerta tipo="info">
          Este reporte ya no está abierto. Si el problema sigue, el ciudadano puede
          reabrirlo desde su folio o levantar uno nuevo.
        </Alerta>
      )}
    </div>
  )
}
