import { prisma } from '@/infrastructure/prisma'
import { Insignia } from '@/components/ui/insignia'
import { SelloDependencia } from '@/components/sello-dependencia'
import { ICONOS_DEPENDENCIA, COLORES_DEPENDENCIA } from '@/domain/identidad-dependencia'
import { Catalogo } from '../catalogo'
import { Importador } from '../importador'
import { guardarDependencia, importarDependencias } from '../acciones'

export const metadata = { title: 'Dependencias' }

export default async function PaginaDependencias() {
  const dependencias = await prisma.dependencia.findMany({
    orderBy: [{ activa: 'desc' }, { nombre: 'asc' }],
    include: { _count: { select: { categorias: true, reportes: true } } },
  })

  return (
    <div className="space-y-6">
      <Importador
        titulo="Cargar dependencias desde Excel"
        explicacion="Sube el directorio de áreas con su responsable. Se actualiza por nombre, así que puedes volver a subirlo corregido."
        columnas={[
          { nombre: 'nombre', obligatoria: true, nota: 'también acepta «dependencia» o «área»' },
          { nombre: 'responsable', obligatoria: true, nota: 'también «titular» o «encargado»' },
          { nombre: 'telefono', obligatoria: false },
          { nombre: 'correo', obligatoria: false, nota: 'a donde llegan las alertas de su área' },
        ]}
        ejemplo="Nombre del Responsable"
        accion={importarDependencias}
      />

      <Catalogo
      titulo="Dependencias"
      descripcion="Las áreas que atienden los reportes. Cada una tiene un ícono y un color con los que se identifica en todo el sistema. Desactivar una no borra su historial: los reportes que ya resolvió siguen contando en los indicadores."
      etiquetaNuevo="Nueva dependencia"
      encabezados={['Dependencia', 'Responsable', 'Contacto', 'Categorías', 'Reportes', 'Estado']}
      filas={dependencias.map((d) => ({
        id: d.id,
        valores: {
          nombre: d.nombre, responsable: d.responsable, telefono: d.telefono,
          correo: d.correo, icono: d.icono, color: d.color, activa: d.activa,
        },
        celdas: [
          <span key="n" className="flex items-center gap-2 font-medium"><SelloDependencia dependencia={d} tamano="mediano" />{d.nombre}</span>,
          d.responsable,
          <div key="c" className="text-xs">
            <p>{d.telefono}</p>
            {d.correo
              ? <a href={`mailto:${d.correo}`} className="text-marca-700 underline">{d.correo}</a>
              : <span className="text-tenue">Sin correo</span>}
          </div>,
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
        { nombre: 'correo', etiqueta: 'Correo del responsable', tipo: 'texto',
          ayuda: 'A donde llegan las alertas de esta área.' },
        { nombre: 'icono', etiqueta: 'Ícono', tipo: 'select', requerido: true,
          opciones: ICONOS_DEPENDENCIA.map(([valor, texto]) => ({ valor, texto })),
          ayuda: 'Con el que se identifica el área en la bandeja, los folios y los tableros.' },
        { nombre: 'color', etiqueta: 'Color', tipo: 'select', requerido: true,
          opciones: Object.entries(COLORES_DEPENDENCIA).map(([valor, c]) => ({ valor, texto: c.nombre })),
          ayuda: 'Que no se repita entre áreas: es lo que las distingue de un vistazo.' },
        { nombre: 'activa', etiqueta: 'Activa', tipo: 'checkbox' },
      ]}
      accion={guardarDependencia}
      />
    </div>
  )
}
