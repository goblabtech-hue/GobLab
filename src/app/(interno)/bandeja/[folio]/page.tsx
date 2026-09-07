import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, MapPin, Phone, User } from 'lucide-react'
import { prisma } from '@/infrastructure/prisma'
import { requerirRol } from '@/infrastructure/auth'
import { semaforo } from '@/domain/dias-habiles'
import { cargarFestivos } from '@/infrastructure/festivos'
import { buscarDuplicados } from '@/application/duplicados'
import { ESTATUS, ESTATUS_ABIERTOS, ORIGEN, PRIORIDAD, SEMAFORO } from '@/domain/presentacion'
import { fecha, fechaHora, haceCuanto } from '@/domain/formato'
import { Tarjeta, TarjetaCuerpo, TarjetaTitulo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { Alerta } from '@/components/ui/alerta'
import { PanelAcciones } from './acciones-ui'
import { BotonTelefono } from './telefono'
import { BitacoraInterna } from './bitacora'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps<'/bandeja/[folio]'>) {
  const { folio } = await params
  return { title: `Reporte ${folio}` }
}

export default async function DetalleBandeja({ params }: PageProps<'/bandeja/[folio]'>) {
  await requerirRol('operador', 'supervisor', 'admin')
  const { folio } = await params

  const r = await prisma.reporte.findUnique({
    where: { folio: folio.toUpperCase() },
    include: {
      categoria: { select: { nombre: true, slaDiasHabiles: true, requiereEvidencia: true } },
      colonia: { select: { nombre: true } },
      dependencia: { select: { id: true, nombre: true } },
      asignadoA: { select: { id: true, nombre: true } },
      reporteOriginal: { select: { folio: true } },
      duplicados: { select: { folio: true } },
      fotos: { orderBy: { createdAt: 'asc' } },
      eventos: {
        orderBy: { timestamp: 'desc' },
        include: { usuario: { select: { nombre: true } } },
      },
      adhesiones: { select: { id: true, telefonoMascara: true, createdAt: true } },
    },
  })
  if (!r) notFound()

  const [festivos, dependencias, cuadrillas, cercanos] = await Promise.all([
    cargarFestivos(),
    prisma.dependencia.findMany({ where: { activa: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    prisma.usuario.findMany({
      where: { rol: 'cuadrilla', activo: true, OR: [{ dependenciaId: r.dependenciaId }, { dependenciaId: null }] },
      orderBy: { nombre: 'asc' }, select: { id: true, nombre: true },
    }),
    buscarDuplicados({ categoriaId: r.categoriaId, lat: r.lat, lng: r.lng, excluirReporteId: r.id }),
  ])

  const abierto = ESTATUS_ABIERTOS.includes(r.estatus)
  const luz = abierto ? semaforo(r.fechaLimite, festivos) : null

  return (
    <div className="space-y-5">
      <Link href="/bandeja" className="inline-flex items-center gap-1.5 text-sm text-tinta-suave hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden />
        Volver a la bandeja
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-tinta-suave">{r.folio}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{r.categoria.nombre}</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {ORIGEN[r.origen]} · {haceCuanto(r.createdAt)} · {fechaHora(r.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Insignia tono={ESTATUS[r.estatus].tono}>{ESTATUS[r.estatus].interno}</Insignia>
          <Insignia tono={PRIORIDAD[r.prioridad].tono}>{PRIORIDAD[r.prioridad].texto}</Insignia>
          {luz && <Insignia tono={SEMAFORO[luz].tono}>{SEMAFORO[luz].texto}</Insignia>}
        </div>
      </div>

      {r.estatus === 'improcedente' && r.motivoImprocedente && (
        <Alerta tipo="aviso" titulo="Marcado como improcedente">{r.motivoImprocedente}</Alerta>
      )}
      {r.reporteOriginal && (
        <Alerta tipo="info" titulo="Duplicado">
          Este reporte se unió a{' '}
          <Link href={`/bandeja/${r.reporteOriginal.folio}`} className="font-mono underline">
            {r.reporteOriginal.folio}
          </Link>.
        </Alerta>
      )}
      {r.duplicados.length > 0 && (
        <Alerta tipo="info" titulo={`${r.duplicados.length} reportes unidos a este`}>
          {r.duplicados.map((d) => (
            <Link key={d.folio} href={`/bandeja/${d.folio}`} className="mr-2 font-mono underline">{d.folio}</Link>
          ))}
        </Alerta>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Tarjeta>
            <TarjetaCuerpo className="space-y-3">
              <TarjetaTitulo>Lo que reportó el ciudadano</TarjetaTitulo>
              <p className="text-pretty">{r.descripcion}</p>

              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Dato icono={MapPin} etiqueta="Ubicación">
                  {r.direccionTexto ?? 'Sin dirección'}
                  {r.colonia && <> · Col. {r.colonia.nombre}</>}
                  {r.lat != null && (
                    <>
                      {' '}
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=18/${r.lat}/${r.lng}`}
                        target="_blank" rel="noreferrer"
                        className="text-marca-700 underline"
                      >
                        ver en el mapa
                      </a>
                    </>
                  )}
                </Dato>

                <Dato icono={Phone} etiqueta="Teléfono">
                  {r.telefonoMascara
                    ? <BotonTelefono reporteId={r.id} mascara={r.telefonoMascara} />
                    : <span className="text-tenue">No lo dejó</span>}
                </Dato>

                <Dato icono={User} etiqueta="Nombre">
                  {r.nombreContacto ?? <span className="text-tenue">No lo dejó</span>}
                </Dato>

                <div>
                  <dt className="text-xs text-tinta-suave">Promesa de servicio</dt>
                  <dd>
                    {r.slaDiasHabilesAplicado} días hábiles · vence {fecha(r.fechaLimite)}
                  </dd>
                </div>
              </dl>

              {r.fotos.filter((f) => f.tipo === 'ciudadano').length > 0 && (
                <div>
                  <p className="mb-2 text-xs text-tinta-suave">Fotos del ciudadano</p>
                  <ul className="flex flex-wrap gap-2">
                    {r.fotos.filter((f) => f.tipo === 'ciudadano').map((f, i) => (
                      <li key={f.id}>
                        <Image src={f.url} alt={`Foto ${i + 1} del ciudadano`} width={120} height={120}
                          unoptimized className="size-28 rounded-lg border border-borde object-cover" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.fotos.filter((f) => f.tipo === 'evidencia').length > 0 && (
                <div>
                  <p className="mb-2 text-xs text-tinta-suave">Evidencia de resolución</p>
                  <ul className="flex flex-wrap gap-2">
                    {r.fotos.filter((f) => f.tipo === 'evidencia').map((f, i) => (
                      <li key={f.id}>
                        <Image src={f.url} alt={`Evidencia ${i + 1}`} width={120} height={120}
                          unoptimized className="size-28 rounded-lg border border-borde object-cover" />
                      </li>
                    ))}
                  </ul>
                  {r.notaCierre && <p className="mt-2 text-sm text-tinta-suave">{r.notaCierre}</p>}
                </div>
              )}

              {r.calificacion !== null && (
                <div className="rounded-lg bg-lienzo p-3 text-sm">
                  <p className="font-medium">Calificación del ciudadano: {r.calificacion} de 5</p>
                  {r.comentarioCalificacion && (
                    <p className="mt-1 text-tinta-suave">«{r.comentarioCalificacion}»</p>
                  )}
                </div>
              )}

              {r.adhesiones.length > 0 && (
                <p className="text-sm text-tinta-suave">
                  {r.adhesiones.length} vecinos se sumaron:{' '}
                  {r.adhesiones.map((a) => a.telefonoMascara).join(', ')}
                </p>
              )}
            </TarjetaCuerpo>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCuerpo>
              <TarjetaTitulo>Bitácora</TarjetaTitulo>
              <BitacoraInterna
                eventos={r.eventos.map((e) => ({
                  id: e.id, tipo: e.tipo, timestamp: e.timestamp.toISOString(),
                  usuario: e.usuario?.nombre ?? null,
                  detalle: e.detalle as Record<string, unknown> | null,
                }))}
              />
            </TarjetaCuerpo>
          </Tarjeta>
        </div>

        <PanelAcciones
          reporteId={r.id}
          folio={r.folio}
          estatus={r.estatus}
          dependenciaActual={r.dependenciaId}
          asignadoA={r.asignadoA}
          dependencias={dependencias}
          cuadrillas={cuadrillas}
          cercanos={cercanos.map((c) => ({
            id: c.id, folio: c.folio, metros: Math.round(c.distanciaMetros),
          }))}
        />
      </div>
    </div>
  )
}

function Dato({
  icono: Icono, etiqueta, children,
}: { icono: React.ElementType; etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-tinta-suave">
        <Icono className="size-3.5" aria-hidden />
        {etiqueta}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}
