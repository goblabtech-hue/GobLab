import { prisma } from '@/infrastructure/prisma'
import { obtenerConfiguracion } from '@/infrastructure/config'
import { FormularioReporte } from './formulario'

export const metadata = {
  title: 'Reportar un problema',
  description: 'Cuéntanos qué está descompuesto en tu colonia. No necesitas cuenta.',
}

export default async function PaginaReportar({ searchParams }: PageProps<'/reportar'>) {
  const { categoria } = await searchParams
  const [categorias, colonias, municipio] = await Promise.all([
    prisma.categoria.findMany({
      where: { activa: true }, orderBy: { orden: 'asc' },
      select: { id: true, slug: true, nombre: true, icono: true, slaDiasHabiles: true },
    }),
    prisma.colonia.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    obtenerConfiguracion(),
  ])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Reportar un problema</h1>
      <p className="mt-1 max-w-2xl text-tinta-suave">
        Te toma menos de dos minutos. Al terminar te damos un folio para que puedas
        seguir tu reporte.
      </p>

      {/* El formulario ocupa el ancho de la página, como el inicio; a un lado,
          lo que va a pasar con el reporte, para que nadie llene cuatro pasos
          sin saber qué sigue. En teléfono el aside va al final. */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
        <FormularioReporte
          categorias={categorias}
          colonias={colonias}
          centro={{ lat: municipio.centroLat, lng: municipio.centroLng, zoom: municipio.zoomInicial }}
          categoriaInicial={typeof categoria === 'string' ? categoria : undefined}
        />

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="text-sm font-semibold">Qué pasa después</h2>
          <ol className="mt-3 space-y-3 text-sm text-tinta-suave">
            {[
              ['Recibes tu folio al instante', 'Con él consultas tu reporte cuando quieras, aquí o por WhatsApp.'],
              ['Una persona lo revisa', 'Alguien de atención ciudadana lo lee y lo registra. Nada llega al área sin que lo haya visto una persona.'],
              ['Llega al área con un plazo', 'Cada tipo de problema tiene un plazo público en días hábiles. Empieza a correr desde que se registra.'],
              ['Te avisamos con foto', 'Cuando la cuadrilla termina, te llega la evidencia y tú confirmas si quedó.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-marca-50 text-xs font-bold text-marca-700 tabular-nums">{i + 1}</span>
                <span><span className="block font-medium text-tinta">{t}</span>{d}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 rounded-lg bg-rojo-50 p-3 text-sm text-rojo-600">
            <strong>¿Es una emergencia?</strong> Llama al{' '}
            <a href={`tel:${municipio.telEmergencias}`} className="font-semibold underline">{municipio.telEmergencias}</a>.
            Aquí no se atienden urgencias.
          </p>
        </aside>
      </div>
    </div>
  )
}
