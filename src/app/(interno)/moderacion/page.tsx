import Link from 'next/link'
import Image from 'next/image'
import { ImageOff } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requerirRol } from '@/lib/auth'
import { fecha, numero } from '@/lib/utils'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { Alerta } from '@/components/ui/alerta'
import { BotonesModeracion } from './botones'

export const metadata = { title: 'Moderar galería' }
export const dynamic = 'force-dynamic'

/**
 * Cola de moderación de la galería antes/después (SPEC §4.4f).
 *
 * Sin esta pantalla el flag `publicable` existía en la base pero nadie podía
 * ponerlo: la galería quedaba congelada con lo que trajera el seed.
 */
export default async function Moderacion({ searchParams }: PageProps<'/moderacion'>) {
  const usuario = await requerirRol('supervisor', 'admin')
  const { ver } = await searchParams
  const viendoPublicados = ver === 'publicados'

  // Un supervisor modera lo de su dependencia; administración ve todo.
  const alcance = usuario.rol === 'supervisor' && usuario.dependenciaId
    ? { dependenciaId: usuario.dependenciaId }
    : {}

  const reportes = await prisma.reporte.findMany({
    where: {
      ...alcance,
      resueltoAt: { not: null },
      publicable: viendoPublicados,
      // Solo tiene sentido moderar lo que puede formar un antes y después.
      AND: [
        { fotos: { some: { tipo: 'ciudadano' } } },
        { fotos: { some: { tipo: 'evidencia' } } },
      ],
    },
    orderBy: { resueltoAt: 'desc' },
    take: 40,
    select: {
      id: true, folio: true, descripcion: true, resueltoAt: true, createdAt: true,
      categoria: { select: { nombre: true } },
      colonia: { select: { nombre: true } },
      fotos: { select: { id: true, url: true, tipo: true } },
    },
  })

  const [pendientes, publicados] = await Promise.all([
    prisma.reporte.count({
      where: { ...alcance, resueltoAt: { not: null }, publicable: false,
        AND: [{ fotos: { some: { tipo: 'ciudadano' } } }, { fotos: { some: { tipo: 'evidencia' } } }] },
    }),
    prisma.reporte.count({ where: { ...alcance, publicable: true } }),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Moderar la galería pública</h1>
        <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
          Decide qué trabajos terminados se muestran en{' '}
          <Link href="/antes-despues" className="text-marca-700 underline">antes y después</Link>.
        </p>
      </div>

      <Alerta tipo="aviso" titulo="Mira bien la foto antes de publicarla">
        Las fotos las toma el ciudadano con su celular. Revisa que no aparezcan
        placas de vehículos, rostros, menores, el interior de una casa ni nada
        que permita identificar a alguien. Ante la duda, no la publiques: el
        tablero funciona igual sin esa foto.
      </Alerta>

      <div role="tablist" className="flex gap-1 border-b border-borde">
        <Pestana href="/moderacion" activa={!viendoPublicados}>
          Por revisar <span className="ml-1 text-tenue">{numero(pendientes)}</span>
        </Pestana>
        <Pestana href="/moderacion?ver=publicados" activa={viendoPublicados}>
          Publicados <span className="ml-1 text-tenue">{numero(publicados)}</span>
        </Pestana>
      </div>

      {reportes.length === 0 ? (
        <Tarjeta>
          <TarjetaCuerpo className="py-12 text-center">
            <ImageOff className="mx-auto size-8 text-tenue" aria-hidden />
            <p className="mt-3 text-tinta-suave">
              {viendoPublicados
                ? 'Todavía no has publicado ningún trabajo.'
                : 'No hay nada por revisar. Aquí aparecen los reportes resueltos que tienen foto antes y después.'}
            </p>
          </TarjetaCuerpo>
        </Tarjeta>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {reportes.map((r) => {
            const antes = r.fotos.find((f) => f.tipo === 'ciudadano')!
            const despues = r.fotos.find((f) => f.tipo === 'evidencia')!
            const dias = Math.max(1, Math.round(
              (r.resueltoAt!.getTime() - r.createdAt.getTime()) / 86_400_000,
            ))
            return (
              <li key={r.id}>
                <Tarjeta className="h-full overflow-hidden">
                  <div className="grid grid-cols-2 gap-px bg-borde">
                    <figure className="relative">
                      <Image src={antes.url} alt={`Antes: ${r.categoria.nombre}`}
                        width={320} height={240} unoptimized className="aspect-4/3 w-full object-cover" />
                      <figcaption className="absolute top-1.5 left-1.5 rounded bg-tinta/75 px-1.5 py-0.5 text-xs font-medium text-papel">
                        Antes
                      </figcaption>
                    </figure>
                    <figure className="relative">
                      <Image src={despues.url} alt={`Después: ${r.categoria.nombre}`}
                        width={320} height={240} unoptimized className="aspect-4/3 w-full object-cover" />
                      <figcaption className="absolute top-1.5 left-1.5 rounded bg-verde-600/85 px-1.5 py-0.5 text-xs font-medium text-papel">
                        Después
                      </figcaption>
                    </figure>
                  </div>

                  <TarjetaCuerpo className="space-y-3 p-3.5">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{r.categoria.nombre}</p>
                        <Insignia tono={viendoPublicados ? 'verde' : 'neutro'}>
                          {dias} {dias === 1 ? 'día' : 'días'}
                        </Insignia>
                      </div>
                      <p className="mt-0.5 text-sm text-tinta-suave">
                        {r.colonia?.nombre ?? 'Sin colonia'} · {fecha(r.resueltoAt!)}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-sm text-tinta-suave">{r.descripcion}</p>
                      <Link href={`/bandeja/${r.folio}`} className="mt-1 inline-block font-mono text-xs text-marca-700 underline">
                        {r.folio}
                      </Link>
                    </div>

                    <BotonesModeracion reporteId={r.id} publicado={viendoPublicados} />
                  </TarjetaCuerpo>
                </Tarjeta>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Pestana({ href, activa, children }: { href: string; activa: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={activa ? 'page' : undefined}
      className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
        activa ? 'border-marca-600 font-medium text-marca-700' : 'border-transparent text-tinta-suave hover:text-tinta'
      }`}
    >
      {children}
    </Link>
  )
}

