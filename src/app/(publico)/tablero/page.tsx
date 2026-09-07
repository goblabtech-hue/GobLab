import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Download, MapPin } from 'lucide-react'
import { prisma } from '@/infrastructure/prisma'
import { obtenerIndicadores } from '@/application/indicadores'
import { obtenerConfiguracion } from '@/infrastructure/config'
import { ESTATUS_ABIERTOS } from '@/domain/presentacion'
import { fecha, fechaHora, numero, pct } from '@/domain/formato'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { IconoCategoria } from '@/components/icono-categoria'
import { Cifra } from '@/components/tablero/cifra'
import { SeccionGraficas } from '@/components/tablero/seccion-graficas'
import { SelectorColonia } from '@/components/tablero/selector-colonia'
import { MapaCliente } from '@/components/tablero/mapa-cliente'
import type { Punto } from '@/components/tablero/mapa-reportes'

export const metadata = {
  title: 'Cómo vamos',
  description: 'Tablero público de atención ciudadana: qué reporta la gente, cuánto tardamos y qué tan bien cumplimos lo que prometemos.',
}

// El tablero se sirve de agregados precalculados (SPEC §7).
export const revalidate = 300

/** Verde ≥90%, ámbar 70–89%, rojo <70% (SPEC §4.4b). */
function tonoCumplimiento(p: number | null) {
  if (p === null) return 'neutro' as const
  if (p >= 90) return 'verde' as const
  if (p >= 70) return 'ambar' as const
  return 'rojo' as const
}

export default async function Tablero() {
  const [datos, puntosCrudos, categorias, colonias, galeria, municipio] = await Promise.all([
    obtenerIndicadores(),
    prisma.reporte.findMany({
      where: { lat: { not: null }, lng: { not: null } },
      select: {
        folio: true, lat: true, lng: true, estatus: true, fechaLimite: true, createdAt: true,
        categoria: { select: { nombre: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1200,
    }),
    prisma.categoria.findMany({
      where: { activa: true }, orderBy: { orden: 'asc' },
      select: { slug: true, nombre: true },
    }),
    prisma.colonia.findMany({ orderBy: { nombre: 'asc' }, select: { slug: true, nombre: true } }),
    prisma.reporte.findMany({
      where: { publicable: true, resueltoAt: { not: null } },
      orderBy: { resueltoAt: 'desc' }, take: 3,
      select: {
        folio: true, resueltoAt: true, createdAt: true,
        categoria: { select: { nombre: true } },
        colonia: { select: { nombre: true } },
        fotos: { select: { url: true, tipo: true } },
      },
    }),
    obtenerConfiguracion(),
  ])

  const ahora = new Date()
  const puntos: Punto[] = puntosCrudos.map((r) => ({
    folio: r.folio,
    lat: r.lat!,
    lng: r.lng!,
    categoria: r.categoria.nombre,
    categoriaSlug: r.categoria.slug,
    estatus: r.estatus,
    abierto: ESTATUS_ABIERTOS.includes(r.estatus),
    vencido: ESTATUS_ABIERTOS.includes(r.estatus) && r.fechaLimite < ahora,
    fecha: fecha(r.createdAt),
  }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Cómo vamos</h1>
        <p className="mt-2 max-w-2xl text-tinta-suave text-pretty">
          Todo lo que ves aquí sale directo del sistema con el que trabajamos,
          sin retoques. Incluye lo que nos sale bien y lo que no: reportes
          vencidos, reportes que tuvimos que pasar de un área a otra, y las
          calificaciones bajas.
        </p>
        <p className="mt-2 text-sm text-tenue">
          Actualizado {fechaHora(datos.generadoAt)} · datos de los últimos {datos.meses} meses
        </p>
      </header>

      {/* ------------------------------------------------ a) resumen */}
      <section aria-labelledby="resumen" className="mt-8">
        <h2 id="resumen" className="sr-only">Resumen</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Cifra titulo="Reportes recibidos" dato={datos.resumen.recibidos} formato={numero} />
          <Cifra titulo="Reportes resueltos" dato={datos.resumen.resueltos} formato={numero} />
          <Cifra
            titulo="Resueltos a tiempo" dato={datos.resumen.cumplimiento}
            formato={(n) => pct(n, 1)} pie="dentro del plazo que prometimos"
          />
          <Cifra
            titulo="Calificación de la gente" dato={datos.resumen.calificacion}
            formato={(n) => (n ? n.toFixed(2) : '—')} pie="de 5 estrellas"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <TasaSimple
            titulo="Reportes abiertos que ya vencieron" valor={datos.tasas.vencidos}
            detalle={`${numero(datos.vencidosAhora)} de ${numero(datos.abiertos)} abiertos`}
          />
          <TasaSimple
            titulo="Reportes que cambiaron de área" valor={datos.tasas.reasignacion}
            detalle="señal de que los clasificamos mal al recibirlos"
          />
          <TasaSimple
            titulo="Reportes que hubo que reabrir" valor={datos.tasas.reapertura}
            detalle="el trabajo no había quedado bien"
          />
        </div>
      </section>

      {/* ------------------------------------------------ b) promesas */}
      <section aria-labelledby="promesas" className="mt-10">
        <h2 id="promesas" className="text-xl font-semibold tracking-tight">
          Lo que prometemos y lo que cumplimos
        </h2>
        <p className="mt-1 mb-4 max-w-2xl text-tinta-suave text-pretty">
          Cada tipo de problema tiene un plazo al que el municipio se compromete.
          Aquí puedes ver, para cada uno, qué tanto lo cumplimos de verdad y
          cuánto tardamos en promedio.
        </p>

        <Tarjeta className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lienzo text-left text-xs tracking-wide text-tinta-suave uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Tipo de problema</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Prometemos</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Tardamos</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Cumplimos</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Resueltos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {datos.promesas.map((p) => (
                  <tr key={p.slug}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-medium">
                        <IconoCategoria nombre={p.icono} className="size-4 shrink-0 text-marca-600" />
                        {p.nombre}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{p.slaDiasHabiles} días hábiles</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.diasPromedio === null
                        ? <span className="text-tenue">—</span>
                        : <>{p.diasPromedio.toFixed(1)} días</>}
                    </td>
                    <td className="px-4 py-3">
                      {p.cumplimiento === null
                        ? <span className="text-tenue">Sin datos</span>
                        : <Insignia tono={tonoCumplimiento(p.cumplimiento)}>{pct(p.cumplimiento)}</Insignia>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{numero(p.resueltos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>

        <p className="mt-2 text-xs text-tenue">
          Verde: cumplimos 90% o más. Ámbar: entre 70% y 89%. Rojo: menos del 70%.
        </p>
      </section>

      {/* ------------------------------------------------ c) mapa */}
      <section aria-labelledby="mapa" className="mt-10">
        <h2 id="mapa" className="text-xl font-semibold tracking-tight">Dónde están los reportes</h2>
        <p className="mt-1 mb-4 max-w-2xl text-tinta-suave">
          Filtra por tipo de problema o por estado. Toca un círculo para ver qué hay ahí.
        </p>
        <MapaCliente
          puntos={puntos} categorias={categorias}
          centro={{ lat: municipio.centroLat, lng: municipio.centroLng, zoom: municipio.zoomInicial }}
        />
      </section>

      {/* ------------------------------------------------ d) mi colonia */}
      <section aria-labelledby="mi-colonia" className="mt-10">
        <Tarjeta className="border-marca-200 bg-marca-50/50">
          <TarjetaCuerpo className="flex flex-wrap items-center gap-4">
            <MapPin className="size-6 shrink-0 text-marca-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 id="mi-colonia" className="text-lg font-semibold">Mi colonia</h2>
              <p className="mt-0.5 text-sm text-tinta-suave">
                Mira cómo vamos en tu colonia y compárala con el resto del municipio.
              </p>
            </div>
            <SelectorColonia colonias={colonias} />
          </TarjetaCuerpo>
        </Tarjeta>
      </section>

      {/* ------------------------------------------------ e) gráficas */}
      <section aria-labelledby="graficas" className="mt-10">
        <h2 id="graficas" className="text-xl font-semibold tracking-tight">El detalle</h2>
        <p className="mt-1 mb-4 max-w-2xl text-tinta-suave">
          Cada gráfica se puede descargar en CSV para revisarla por tu cuenta.
        </p>
        <SeccionGraficas datos={datos} />
      </section>

      {/* ------------------------------------------------ f) antes/después */}
      {galeria.length > 0 && (
        <section aria-labelledby="galeria" className="mt-10">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 id="galeria" className="text-xl font-semibold tracking-tight">Antes y después</h2>
              <p className="mt-1 text-tinta-suave">Trabajos terminados, con foto de cómo estaba y cómo quedó.</p>
            </div>
            <Link href="/antes-despues" className="text-sm font-medium text-marca-700 underline whitespace-nowrap">
              Ver todos
            </Link>
          </div>

          <ul className="grid gap-4 sm:grid-cols-3">
            {galeria.map((r) => {
              const antes = r.fotos.find((f) => f.tipo === 'ciudadano')
              const despues = r.fotos.find((f) => f.tipo === 'evidencia')
              if (!antes || !despues) return null
              const dias = Math.max(
                1,
                Math.round((r.resueltoAt!.getTime() - r.createdAt.getTime()) / 86_400_000),
              )
              return (
                <li key={r.folio}>
                  <Tarjeta className="h-full overflow-hidden">
                    <div className="grid grid-cols-2 gap-px bg-borde">
                      <Image src={antes.url} alt={`Antes: ${r.categoria.nombre}`} width={300} height={220}
                        unoptimized className="aspect-4/3 w-full object-cover" />
                      <Image src={despues.url} alt={`Después: ${r.categoria.nombre}`} width={300} height={220}
                        unoptimized className="aspect-4/3 w-full object-cover" />
                    </div>
                    <TarjetaCuerpo className="p-3">
                      <p className="font-medium">{r.categoria.nombre}</p>
                      <p className="text-sm text-tinta-suave">
                        {r.colonia?.nombre ?? 'Sin colonia'} · resuelto en {dias} {dias === 1 ? 'día' : 'días'}
                      </p>
                    </TarjetaCuerpo>
                  </Tarjeta>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------ g) datos abiertos */}
      <section aria-labelledby="datos" className="mt-10">
        <Tarjeta>
          <TarjetaCuerpo className="flex flex-wrap items-center gap-4">
            <Download className="size-6 shrink-0 text-marca-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 id="datos" className="text-lg font-semibold">Datos abiertos</h2>
              <p className="mt-0.5 text-sm text-tinta-suave">
                Descarga la base completa de reportes, sin datos personales, en CSV o JSON.
                Se actualiza en tiempo real.
              </p>
            </div>
            <Link
              href="/datos-abiertos"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-marca-600 px-4 text-sm font-medium text-white hover:bg-marca-700"
            >
              Ir a datos abiertos
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </TarjetaCuerpo>
        </Tarjeta>
      </section>
    </div>
  )
}

function TasaSimple({ titulo, valor, detalle }: { titulo: string; valor: number; detalle: string }) {
  return (
    <Tarjeta>
      <TarjetaCuerpo className="p-4">
        <p className="text-sm text-tinta-suave">{titulo}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{pct(valor, 1)}</p>
        <p className="text-xs text-tenue">{detalle}</p>
      </TarjetaCuerpo>
    </Tarjeta>
  )
}
