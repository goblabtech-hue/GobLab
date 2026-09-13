import {
  Accessibility,
  AlertTriangle,
  Ban,
  Biohazard,
  BrickWall,
  Bridge,
  Bug,
  Bus,
  Cable,
  Car,
  Church,
  CircleDashed,
  CloudRain,
  Construction,
  Container,
  Dog,
  DropletOff,
  Droplets,
  FileQuestion,
  Fish,
  Flame,
  FlaskConical,
  Footprints,
  Gauge,
  HardHat,
  LightbulbOff,
  Megaphone,
  Mountain,
  OctagonAlert,
  Paintbrush,
  Route,
  Scissors,
  SprayCan,
  Sprout,
  Store,
  Sun,
  TrafficCone,
  Trash2,
  TreeDeciduous,
  Trees,
  Truck,
  UtilityPole,
  Volume2,
  Waves,
  CircleHelp,
  type LucideIcon,
} from 'lucide-react'

/**
 * Íconos de categoría. Se listan uno por uno en vez de importar el paquete
 * completo de Lucide: el catálogo son ~1500 íconos y el tablero público tiene
 * que cargar en menos de 3 s en 4G (SPEC §7).
 *
 * Los nombres son los del catálogo maestro (src/domain/catalogo-categorias.ts)
 * y los que guarda /admin/categorias.
 */
const ICONOS: Record<string, LucideIcon> = {
  accessibility: Accessibility,
  'alert-triangle': AlertTriangle,
  ban: Ban,
  biohazard: Biohazard,
  'brick-wall': BrickWall,
  bridge: Bridge,
  bug: Bug,
  bus: Bus,
  cable: Cable,
  car: Car,
  church: Church,
  'circle-dashed': CircleDashed,
  'cloud-rain': CloudRain,
  construction: Construction,
  container: Container,
  dog: Dog,
  'droplet-off': DropletOff,
  droplets: Droplets,
  'file-question': FileQuestion,
  fish: Fish,
  flame: Flame,
  'flask-conical': FlaskConical,
  footprints: Footprints,
  gauge: Gauge,
  'hard-hat': HardHat,
  'lightbulb-off': LightbulbOff,
  megaphone: Megaphone,
  mountain: Mountain,
  'octagon-alert': OctagonAlert,
  paintbrush: Paintbrush,
  route: Route,
  scissors: Scissors,
  'spray-can': SprayCan,
  sprout: Sprout,
  store: Store,
  sun: Sun,
  'traffic-cone': TrafficCone,
  'trash-2': Trash2,
  'tree-deciduous': TreeDeciduous,
  trees: Trees,
  truck: Truck,
  'utility-pole': UtilityPole,
  'volume-2': Volume2,
  waves: Waves,
}

export function IconoCategoria({
  nombre, className,
}: { nombre: string; className?: string }) {
  const Icono = ICONOS[nombre] ?? CircleHelp
  return <Icono className={className} aria-hidden />
}

/** Para que /admin muestre qué nombres existen. */
export const NOMBRES_ICONO = Object.keys(ICONOS)
