import Link from 'next/link'
import { ArrowRight, Search, Clock, Star } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { numero, pct } from '@/lib/utils'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Boton } from '@/components/ui/boton'
import { IconoCategoria } from '@/components/icono-categoria'

export const revalidate = 300

async function resumen() {
  const desde = new Date()
  desde.setMonth(desde.getMonth() - 12)

  const [recibidos, resueltos, aTiempo, califs] = await Promise.all([
    prisma.reporte.count({ where: { createdAt: { gte: desde } } }),
    prisma.reporte.count({ where: { resueltoAt: { gte: desde } } }),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM "Reporte"
      WHERE "resueltoAt" >= ${desde} AND "resueltoAt" <= "fechaLimite"`,
    prisma.reporte.aggregate({
      _avg: { calificacion: true },
      where: { calificacion: { not: null }, cerradoAt: { gte: desde } },
    }),
  ])

  return {
    recibidos,
    resueltos,
    cumplimiento: resueltos ? (Number(aTiempo[0].n) / resueltos) * 100 : 0,
    calificacion: califs._avg.calificacion ?? 0,
  }
}

export default async function Inicio() {
  const [datos, categorias] = await Promise.all([
    resumen(),
    prisma.categoria.findMany({
      where: { activa: true }, orderBy: { orden: 'asc' }, take: 8,
      select: { slug: true, nombre: true, icono: true, slaDiasHabiles: true },
    }),
  ])

  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="py-10 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          ¿Hay algo descompuesto en tu colonia?
        </h1>
        <p className="mt-3 max-w-xl text-lg text-tinta-suave text-pretty">
          Repórtalo aquí en menos de dos minutos. No necesitas cuenta ni contraseña:
          te damos un folio y con él puedes ver cómo va tu reporte.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/reportar">
            <Boton tamano="lg">
              Reportar un problema
              <ArrowRight aria-hidden />
            </Boton>
          </Link>
          <Link href="/folio">
            <Boton tamano="lg" variante="secundario">
              <Search aria-hidden />
              Consultar mi folio
            </Boton>
          </Link>
        </div>
      </section>

      <section aria-labelledby="como-vamos" className="pb-10">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="como-vamos" className="text-lg font-semibold">Cómo vamos, en los últimos 12 meses</h2>
          <Link href="/tablero" className="text-sm font-medium text-marca-700 underline whitespace-nowrap">
            Ver el tablero
          </Link>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato titulo="Reportes recibidos" valor={numero(datos.recibidos)} />
          <Dato titulo="Reportes resueltos" valor={numero(datos.resueltos)} />
          <Dato
            titulo="Resueltos a tiempo" valor={pct(datos.cumplimiento)}
            pie="dentro del plazo prometido" icono={Clock}
          />
          <Dato
            titulo="Calificación de la gente"
            valor={datos.calificacion ? datos.calificacion.toFixed(1) : '—'}
            pie="de 5 estrellas" icono={Star}
          />
        </dl>
      </section>

      <section aria-labelledby="categorias" className="pb-6">
        <h2 id="categorias" className="mb-1 text-lg font-semibold">¿Qué puedes reportar?</h2>
        <p className="mb-4 text-sm text-tinta-suave">
          Cada tipo de problema tiene un plazo que el municipio se compromete a cumplir.
        </p>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categorias.map((c) => (
            <li key={c.slug}>
              <Link href={`/reportar?categoria=${c.slug}`} className="block h-full">
                <Tarjeta className="h-full transition-colors hover:border-marca-200 hover:bg-marca-50/40">
                  <TarjetaCuerpo className="p-3.5">
                    <IconoCategoria nombre={c.icono} className="size-6 text-marca-600" />
                    <p className="mt-2 text-sm leading-snug font-medium">{c.nombre}</p>
                    <p className="mt-0.5 text-xs text-tinta-suave">
                      {c.slaDiasHabiles} días hábiles
                    </p>
                  </TarjetaCuerpo>
                </Tarjeta>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Dato({
  titulo, valor, pie, icono: Icono,
}: { titulo: string; valor: string; pie?: string; icono?: React.ElementType }) {
  return (
    <Tarjeta>
      <TarjetaCuerpo className="p-4">
        <dt className="flex items-center gap-1.5 text-xs text-tinta-suave">
          {Icono && <Icono className="size-3.5" aria-hidden />}
          {titulo}
        </dt>
        <dd className="mt-1 text-2xl font-semibold tabular-nums">{valor}</dd>
        {pie && <p className="text-xs text-tenue">{pie}</p>}
      </TarjetaCuerpo>
    </Tarjeta>
  )
}
