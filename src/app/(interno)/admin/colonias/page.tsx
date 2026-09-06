import { prisma } from '@/lib/prisma'
import { Catalogo } from '../catalogo'
import { guardarColonia } from '../acciones'

export const metadata = { title: 'Colonias' }

export default async function PaginaColonias() {
  const colonias = await prisma.colonia.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { reportes: true } } },
  })

  return (
    <Catalogo
      titulo="Colonias"
      descripcion='Alimentan el módulo "Mi colonia" del tablero público y sirven de respaldo cuando el celular del ciudadano no da ubicación. El centro es opcional: se usa para centrar el mapa de la colonia.'
      etiquetaNuevo="Nueva colonia"
      encabezados={['Colonia', 'Identificador', 'Centro', 'Reportes']}
      filas={colonias.map((c) => ({
        id: c.id,
        valores: { nombre: c.nombre, centroLat: c.centroLat, centroLng: c.centroLng },
        celdas: [
          <span key="n" className="font-medium">{c.nombre}</span>,
          <code key="s" className="text-xs text-tinta-suave">{c.slug}</code>,
          c.centroLat != null && c.centroLng != null
            ? `${c.centroLat.toFixed(4)}, ${c.centroLng.toFixed(4)}`
            : <span key="c" className="text-tenue">Sin ubicar</span>,
          c._count.reportes,
        ],
      }))}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
        { nombre: 'centroLat', etiqueta: 'Latitud del centro', tipo: 'numero' },
        { nombre: 'centroLng', etiqueta: 'Longitud del centro', tipo: 'numero' },
      ]}
      accion={guardarColonia}
    />
  )
}
