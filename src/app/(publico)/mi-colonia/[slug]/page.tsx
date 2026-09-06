import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingDown, TrendingUp } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cargarFestivos, diasHabilesEntre } from '@/lib/sla'
import { ESTATUS_ABIERTOS } from '@/lib/presentacion'
import { numero, pct } from '@/lib/utils'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { IconoCategoria } from '@/components/icono-categoria'

export const revalidate = 300

export async function generateMetadata({ params }: PageProps<'/mi-colonia/[slug]'>) {
  const { slug } = await params
  const colonia = await prisma.colonia.findUnique({ where: { slug }, select: { nombre: true } })
  return {
    title: colonia ? `Col. ${colonia.nombre}` : 'Mi colonia',
    description: colonia
      ? `Cómo va la atención de reportes en la colonia ${colonia.nombre}.`
      : undefined,
  }
}

export async function generateStaticParams() {
  const colonias = await prisma.colonia.findMany({ select: { slug: true } })
  return colonias.map((c) => ({ slug: c.slug }))
}

/**
 * "Mi colonia" (SPEC §4.4d): estadísticas hiperlocales.
 *
 * Es uno de los diferenciadores del proyecto — San Pedro no tiene vista
 * geográfica por colonia — y su gracia está en la comparación: un número solo
 * ("5.2 días") no le dice nada al vecino; "5.2 días, contra 4.1 del municipio"
 * sí le dice si su colonia va rezagada.
 */
export default async function MiColonia({ params }: PageProps<'/mi-colonia/[slug]'>) {
  const { slug } = await params

  const colonia = await prisma.colonia.findUnique({
    where: { slug }, select: { id: true, nombre: true },
  })
  if (!colonia) notFound()

  const hace12 = new Date()
  hace12.setMonth(hace12.getMonth() - 12)
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const [festivos, activos, resueltosMes, resueltosColonia, resueltosMunicipio, porCategoria, otras] =
    await Promise.all([
      cargarFestivos(),
      prisma.reporte.count({
        where: { coloniaId: colonia.id, estatus: { in: ESTATUS_ABIERTOS } },
      }),
      prisma.reporte.count({
        where: { coloniaId: colonia.id, resueltoAt: { gte: inicioMes } },
      }),
      prisma.reporte.findMany({
        where: { coloniaId: colonia.id, resueltoAt: { gte: hace12 } },
        select: { createdAt: true, resueltoAt: true, fechaLimite: true },
      }),
      prisma.reporte.findMany({
        where: { resueltoAt: { gte: hace12 } },
        select: { createdAt: true, resueltoAt: true, fechaLimite: true },
      }),
      prisma.reporte.groupBy({
        by: ['categoriaId'], _count: true,
        where: { coloniaId: colonia.id, createdAt: { gte: hace12 } },
        orderBy: { _count: { categoriaId: 'desc' } },
        take: 5,
      }),
      prisma.colonia.findMany({
        where: { slug: { not: slug } }, orderBy: { nombre: 'asc' },
        select: { slug: true, nombre: true },
      }),
    ])

  const promedio = (rs: { createdAt: Date; resueltoAt: Date | null }[]) =>
    rs.length
      ? rs.reduce((s, r) => s + diasHabilesEntre(r.createdAt, r.resueltoAt!, festivos), 0) / rs.length
      : null
  const puntual = (rs: { resueltoAt: Date | null; fechaLimite: Date }[]) =>
    rs.length ? (rs.filter((r) => r.resueltoAt! <= r.fechaLimite).length / rs.length) * 100 : null

  const diasColonia = promedio(resueltosColonia)
  const diasMunicipio = promedio(resueltosMunicipio)
  const cumpleColonia = puntual(resueltosColonia)
  const cumpleMunicipio = puntual(resueltosMunicipio)

  const categorias = await prisma.categoria.findMany({
    where: { id: { in: porCategoria.map((c) => c.categoriaId) } },
    select: { id: true, nombre: true, icono: true },
  })
  const nombreCat = new Map(categorias.map((c) => [c.id, c]))

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/tablero" className="inline-flex items-center gap-1.5 text-sm text-tinta-suave hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden />
        Volver al tablero
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Colonia {colonia.nombre}</h1>
      <p className="mt-2 text-tinta-suave">
        Cómo va la atención de reportes aquí, comparada con el resto del municipio.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Tarjeta>
          <TarjetaCuerpo className="p-4">
            <p className="text-sm text-tinta-suave">Reportes abiertos ahora</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{numero(activos)}</p>
          </TarjetaCuerpo>
        </Tarjeta>

        <Tarjeta>
          <TarjetaCuerpo className="p-4">
            <p className="text-sm text-tinta-suave">Resueltos este mes</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{numero(resueltosMes)}</p>
          </TarjetaCuerpo>
        </Tarjeta>

        <Comparacion
          titulo="Cuánto tardamos aquí"
          valor={diasColonia === null ? null : `${diasColonia.toFixed(1)} días`}
          referencia={diasMunicipio === null ? null : `${diasMunicipio.toFixed(1)} días`}
          mejor={diasColonia !== null && diasMunicipio !== null ? diasColonia <= diasMunicipio : null}
          textoMejor="más rápido que el promedio del municipio"
          textoPeor="más lento que el promedio del municipio"
        />

        <Comparacion
          titulo="Cumplimos el plazo"
          valor={cumpleColonia === null ? null : pct(cumpleColonia)}
          referencia={cumpleMunicipio === null ? null : pct(cumpleMunicipio)}
          mejor={cumpleColonia !== null && cumpleMunicipio !== null ? cumpleColonia >= cumpleMunicipio : null}
          textoMejor="mejor que el promedio del municipio"
          textoPeor="por debajo del promedio del municipio"
        />
      </div>

      {porCategoria.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Lo que más se reporta aquí</h2>
          <Tarjeta className="overflow-hidden">
            <ul className="divide-y divide-borde">
              {porCategoria.map((g) => {
                const cat = nombreCat.get(g.categoriaId)
                if (!cat) return null
                return (
                  <li key={g.categoriaId} className="flex items-center gap-3 px-4 py-3">
                    <IconoCategoria nombre={cat.icono} className="size-5 shrink-0 text-marca-600" />
                    <span className="flex-1 font-medium">{cat.nombre}</span>
                    <Insignia>{numero(g._count)} reportes</Insignia>
                  </li>
                )
              })}
            </ul>
          </Tarjeta>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Ver otra colonia</h2>
        <ul className="flex flex-wrap gap-2">
          {otras.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/mi-colonia/${c.slug}`}
                className="inline-block rounded-lg border border-borde bg-papel px-3 py-1.5 text-sm hover:bg-lienzo"
              >
                {c.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Comparacion({
  titulo, valor, referencia, mejor, textoMejor, textoPeor,
}: {
  titulo: string
  valor: string | null
  referencia: string | null
  mejor: boolean | null
  textoMejor: string
  textoPeor: string
}) {
  return (
    <Tarjeta>
      <TarjetaCuerpo className="p-4">
        <p className="text-sm text-tinta-suave">{titulo}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{valor ?? '—'}</p>
        {referencia === null ? (
          <p className="mt-1 text-xs text-tenue">Todavía no hay suficientes reportes resueltos aquí.</p>
        ) : (
          <p className={`mt-2 flex items-start gap-1.5 text-sm ${mejor ? 'text-verde-600' : 'text-ambar-600'}`}>
            {mejor
              ? <TrendingUp className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              : <TrendingDown className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
            <span>{mejor ? textoMejor : textoPeor} ({referencia})</span>
          </p>
        )}
      </TarjetaCuerpo>
    </Tarjeta>
  )
}
