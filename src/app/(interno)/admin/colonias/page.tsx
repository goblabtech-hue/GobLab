import { prisma } from '@/infrastructure/prisma'
import { Catalogo } from '../catalogo'
import { Importador } from '../importador'
import { guardarColonia, importarColonias } from '../acciones'

export const metadata = { title: 'Colonias' }

export default async function PaginaColonias() {
  const colonias = await prisma.colonia.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { reportes: true } } },
  })

  return (
    <div className="space-y-6">
      <Importador
        titulo="Cargar colonias desde Excel"
        explicacion="Si ya tienes el listado en una hoja de cálculo, súbelo y se dan de alta todas de una vez."
        columnas={[
          { nombre: 'nombre', obligatoria: true, nota: 'también acepta «colonia» o «asentamiento»' },
          { nombre: 'cp', obligatoria: false, nota: 'distingue nombres repetidos en distintos puntos' },
          { nombre: 'tipo', obligatoria: false, nota: 'colonia, pueblo, fraccionamiento, barrio…' },
          { nombre: 'lat', obligatoria: false, nota: 'centra el mapa de esa colonia' },
          { nombre: 'lng', obligatoria: false 
          },
        ]}
        ejemplo="Nombre de la Colonia"
        accion={importarColonias}
      />

      <Catalogo
      titulo="Colonias"
      descripcion='Alimentan el módulo "Mi colonia" del tablero público y sirven de respaldo cuando el celular del ciudadano no da ubicación. El código postal distingue los nombres que se repiten en distintos puntos del municipio; sin él, una cuadrilla puede salir al lugar equivocado.'
      etiquetaNuevo="Nueva colonia"
      encabezados={['Asentamiento', 'C.P.', 'Identificador', 'Centro', 'Reportes']}
      filas={colonias.map((c) => ({
        id: c.id,
        valores: {
          nombre: c.nombre, codigoPostal: c.codigoPostal, tipo: c.tipo,
          centroLat: c.centroLat, centroLng: c.centroLng,
        },
        celdas: [
          <span key="n">
            <span className="font-medium">{c.nombre}</span>
            {c.tipo && c.tipo !== 'Colonia' && (
              <span className="ml-1.5 text-xs text-tinta-suave">{c.tipo}</span>
            )}
          </span>,
          <span key="cp" className="tabular-nums text-tinta-suave">
            {c.codigoPostal ?? <span className="text-tenue">—</span>}
          </span>,
          <code key="s" className="text-xs text-tinta-suave">{c.slug}</code>,
          c.centroLat != null && c.centroLng != null
            ? `${c.centroLat.toFixed(4)}, ${c.centroLng.toFixed(4)}`
            : <span key="c" className="text-tenue">Sin ubicar</span>,
          c._count.reportes,
        ],
      }))}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
        { nombre: 'codigoPostal', etiqueta: 'Código postal', tipo: 'texto' },
        { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'texto' },
        { nombre: 'centroLat', etiqueta: 'Latitud del centro', tipo: 'numero' },
        { nombre: 'centroLng', etiqueta: 'Longitud del centro', tipo: 'numero' },
      ]}
      accion={guardarColonia}
      />
    </div>
  )
}
