import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { fecha, numero } from '@/lib/utils'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { Alerta } from '@/components/ui/alerta'

export const metadata = {
  title: 'Antes y después',
  description: 'Trabajos terminados en el municipio, con foto de cómo estaba el problema y cómo quedó.',
}

export const revalidate = 300

/**
 * Galería pública (SPEC §4.4f). Solo entran reportes que un supervisor marcó
 * como publicables: la moderación existe porque las fotos las toma el
 * ciudadano y pueden incluir placas, fachadas o personas.
 */
export default async function AntesDespues() {
  const reportes = await prisma.reporte.findMany({
    where: { publicable: true, resueltoAt: { not: null } },
    orderBy: { resueltoAt: 'desc' },
    take: 60,
    select: {
      folio: true, createdAt: true, resueltoAt: true,
      categoria: { select: { nombre: true } },
      colonia: { select: { nombre: true } },
      fotos: { select: { url: true, tipo: true } },
    },
  })

  const conPar = reportes.filter(
    (r) => r.fotos.some((f) => f.tipo === 'ciudadano') && r.fotos.some((f) => f.tipo === 'evidencia'),
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Antes y después</h1>
      <p className="mt-2 max-w-2xl text-tinta-suave text-pretty">
        Trabajos terminados, con la foto que mandó el vecino y la que subió la
        cuadrilla al cerrar. Son {numero(conPar.length)} casos.
      </p>

      {conPar.length === 0 ? (
        <Alerta tipo="info" className="mt-6">
          Todavía no hay trabajos autorizados para mostrar aquí.
        </Alerta>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {conPar.map((r) => {
            const antes = r.fotos.find((f) => f.tipo === 'ciudadano')!
            const despues = r.fotos.find((f) => f.tipo === 'evidencia')!
            const dias = Math.max(
              1,
              Math.round((r.resueltoAt!.getTime() - r.createdAt.getTime()) / 86_400_000),
            )
            return (
              <li key={r.folio}>
                <Tarjeta className="h-full overflow-hidden">
                  <div className="grid grid-cols-2 gap-px bg-borde">
                    <figure className="relative">
                      <Image src={antes.url} alt={`Antes de atender: ${r.categoria.nombre}`}
                        width={320} height={240} unoptimized className="aspect-4/3 w-full object-cover" />
                      <figcaption className="absolute top-1.5 left-1.5 rounded bg-tinta/75 px-1.5 py-0.5 text-xs font-medium text-papel">
                        Antes
                      </figcaption>
                    </figure>
                    <figure className="relative">
                      <Image src={despues.url} alt={`Después de atender: ${r.categoria.nombre}`}
                        width={320} height={240} unoptimized className="aspect-4/3 w-full object-cover" />
                      <figcaption className="absolute top-1.5 left-1.5 rounded bg-verde-600/85 px-1.5 py-0.5 text-xs font-medium text-papel">
                        Después
                      </figcaption>
                    </figure>
                  </div>

                  <TarjetaCuerpo className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{r.categoria.nombre}</p>
                      <Insignia tono="verde">{dias} {dias === 1 ? 'día' : 'días'}</Insignia>
                    </div>
                    <p className="mt-0.5 text-sm text-tinta-suave">
                      {r.colonia?.nombre ?? 'Sin colonia'} · {fecha(r.resueltoAt!)}
                    </p>
                    <Link href={`/folio/${r.folio}`} className="mt-1.5 inline-block font-mono text-xs text-marca-700 underline">
                      {r.folio}
                    </Link>
                  </TarjetaCuerpo>
                </Tarjeta>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-8 text-sm text-tenue">
        Solo se publican los casos que una persona del municipio revisó y
        autorizó, para no exponer datos de nadie en las fotos.
      </p>
    </div>
  )
}
