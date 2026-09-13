import { prisma } from '@/infrastructure/prisma'
import { Insignia } from '@/components/ui/insignia'
import { Catalogo } from '../catalogo'
import { guardarCategoria } from '../acciones'
import { CatalogoMaestro } from './catalogo-maestro'

export const metadata = { title: 'Categorías' }

export default async function PaginaCategorias() {
  const [categorias, dependencias] = await Promise.all([
    prisma.categoria.findMany({
      orderBy: [{ activa: 'desc' }, { orden: 'asc' }],
      include: { dependencia: { select: { nombre: true } } },
    }),
    prisma.dependencia.findMany({ where: { activa: true }, orderBy: { nombre: 'asc' } }),
  ])

  return (
    <div className="space-y-6">
      <CatalogoMaestro activos={categorias.filter((c) => c.activa).map((c) => c.slug)} />

    <Catalogo
      titulo="Categorías y promesas de servicio"
      descripcion="El plazo que pongas aquí es el compromiso público del municipio: aparece en el acuse del ciudadano y se mide en el tablero abierto. Cambiarlo solo afecta a los reportes nuevos, no recalcula los que ya existen."
      etiquetaNuevo="Nueva categoría"
      encabezados={['Categoría', 'Promesa', 'Dependencia', 'Evidencia', 'Estado']}
      filas={categorias.map((c) => ({
        id: c.id,
        valores: {
          nombre: c.nombre, icono: c.icono, descripcionCorta: c.descripcionCorta,
          slaDiasHabiles: c.slaDiasHabiles, dependenciaId: c.dependenciaId,
          requiereEvidencia: c.requiereEvidencia, activa: c.activa,
        },
        celdas: [
          <div key="n">
            <p className="font-medium">{c.nombre}</p>
            {c.descripcionCorta && <p className="text-xs text-tinta-suave">{c.descripcionCorta}</p>}
          </div>,
          <span key="s" className="whitespace-nowrap">{c.slaDiasHabiles} días hábiles</span>,
          c.dependencia.nombre,
          c.requiereEvidencia
            ? <Insignia key="e" tono="marca">Foto obligatoria</Insignia>
            : <Insignia key="e">No aplica</Insignia>,
          c.activa
            ? <Insignia key="a" tono="verde">Activa</Insignia>
            : <Insignia key="a">Inactiva</Insignia>,
        ],
      }))}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre que ve el ciudadano', tipo: 'texto', requerido: true,
          ayuda: 'En lenguaje sencillo: "Bache en la calle", no "Deterioro de carpeta asfáltica".' },
        { nombre: 'icono', etiqueta: 'Ícono', tipo: 'texto', requerido: true,
          ayuda: 'Nombre de un ícono de Lucide, por ejemplo: construction, lightbulb-off, droplets.' },
        { nombre: 'descripcionCorta', etiqueta: 'Descripción corta', tipo: 'texto' },
        { nombre: 'slaDiasHabiles', etiqueta: 'Promesa de servicio (días hábiles)', tipo: 'numero', requerido: true, min: 1, max: 60 },
        { nombre: 'dependenciaId', etiqueta: 'Dependencia responsable', tipo: 'select', requerido: true,
          opciones: dependencias.map((d) => ({ valor: d.id, texto: d.nombre })) },
        { nombre: 'requiereEvidencia', etiqueta: 'Exigir foto de evidencia al cerrar', tipo: 'checkbox' },
        { nombre: 'activa', etiqueta: 'Activa (se muestra al ciudadano)', tipo: 'checkbox' },
      ]}
      accion={guardarCategoria}
    />
    </div>
  )
}
