import {
  Construction, LightbulbOff, Droplets, Trash2, TreeDeciduous, Footprints,
  TrafficCone, Trees, Volume2, Dog, Waves, FileQuestion, CircleHelp,
  type LucideIcon,
} from 'lucide-react'

/**
 * Íconos de categoría. Se listan uno por uno en vez de importar el paquete
 * completo de Lucide: el catálogo son ~1500 íconos y el tablero público tiene
 * que cargar en menos de 3 s en 4G (SPEC §7).
 *
 * Los nombres son los que guarda el catálogo en /admin/categorias.
 */
const ICONOS: Record<string, LucideIcon> = {
  construction: Construction,
  'lightbulb-off': LightbulbOff,
  droplets: Droplets,
  'trash-2': Trash2,
  'tree-deciduous': TreeDeciduous,
  footprints: Footprints,
  'traffic-cone': TrafficCone,
  trees: Trees,
  'volume-2': Volume2,
  dog: Dog,
  waves: Waves,
  'file-question': FileQuestion,
}

export function IconoCategoria({
  nombre, className,
}: { nombre: string; className?: string }) {
  const Icono = ICONOS[nombre] ?? CircleHelp
  return <Icono className={className} aria-hidden />
}

/** Para que /admin muestre qué nombres existen. */
export const NOMBRES_ICONO = Object.keys(ICONOS)
