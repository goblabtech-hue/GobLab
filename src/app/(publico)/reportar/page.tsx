import { prisma } from '@/lib/prisma'
import { FormularioReporte } from './formulario'

export const metadata = {
  title: 'Reportar un problema',
  description: 'Cuéntanos qué está descompuesto en tu colonia. No necesitas cuenta.',
}

export default async function PaginaReportar({ searchParams }: PageProps<'/reportar'>) {
  const { categoria } = await searchParams
  const [categorias, colonias] = await Promise.all([
    prisma.categoria.findMany({
      where: { activa: true }, orderBy: { orden: 'asc' },
      select: { id: true, slug: true, nombre: true, icono: true, slaDiasHabiles: true },
    }),
    prisma.colonia.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
  ])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Reportar un problema</h1>
      <p className="mt-1 mb-8 text-tinta-suave">
        Te toma menos de dos minutos. Al terminar te damos un folio para que puedas
        seguir tu reporte.
      </p>

      <FormularioReporte
        categorias={categorias}
        colonias={colonias}
        categoriaInicial={typeof categoria === 'string' ? categoria : undefined}
      />
    </div>
  )
}
