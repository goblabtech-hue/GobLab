import { prisma } from '@/lib/prisma'
import { Insignia } from '@/components/ui/insignia'
import { Catalogo } from '../catalogo'
import { guardarDependencia } from '../acciones'

export const metadata = { title: 'Dependencias' }

export default async function PaginaDependencias() {
  const dependencias = await prisma.dependencia.findMany({
    orderBy: [{ activa: 'desc' }, { nombre: 'asc' }],
    include: { _count: { select: { categorias: true, reportes: true } } },
  })

  return (
    <Catalogo
      titulo="Dependencias"
      descripcion="Las áreas que atienden los reportes. Desactivar una no borra su historial: los reportes que ya resolvió siguen contando en los indicadores."
      etiquetaNuevo="Nueva dependencia"
      encabezados={['Dependencia', 'Responsable', 'Teléfono', 'Categorías', 'Reportes', 'Estado']}
      filas={dependencias.map((d) => ({
        id: d.id,
        valores: { nombre: d.nombre, responsable: d.responsable, telefono: d.telefono, activa: d.activa },
        celdas: [
          <span key="n" className="font-medium">{d.nombre}</span>,
          d.responsable,
          d.telefono,
          d._count.categorias,
          d._count.reportes,
          d.activa
            ? <Insignia key="e" tono="verde">Activa</Insignia>
            : <Insignia key="e">Inactiva</Insignia>,
        ],
      }))}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
        { nombre: 'responsable', etiqueta: 'Persona responsable', tipo: 'texto', requerido: true },
        { nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'texto', requerido: true, ayuda: 'Solo dígitos.' },
        { nombre: 'activa', etiqueta: 'Activa', tipo: 'checkbox' },
      ]}
      accion={guardarDependencia}
    />
  )
}
