import {
  Building2, Truck, HardHat, Droplets, ShieldCheck, Leaf, ScrollText, HeartPulse, Eye, Siren,
  Lightbulb, Trees, Landmark, Scale, Bus, Wrench, Users, Recycle, Store, Home, type LucideIcon,
} from 'lucide-react'
import { colorDependencia } from '@/domain/identidad-dependencia'
import { cn } from '@/domain/formato'

const ICONOS: Record<string, LucideIcon> = {
  'building-2': Building2, truck: Truck, 'hard-hat': HardHat, droplets: Droplets, 'shield-check': ShieldCheck,
  leaf: Leaf, 'scroll-text': ScrollText, 'heart-pulse': HeartPulse, eye: Eye, siren: Siren, lightbulb: Lightbulb,
  trees: Trees, landmark: Landmark, scale: Scale, bus: Bus, wrench: Wrench, users: Users, recycle: Recycle,
  store: Store, home: Home,
}

export type DependenciaSello = { nombre: string; icono?: string | null; color?: string | null }

/**
 * El sello de una dependencia: ícono sobre su color. Es lo mismo en todas
 * partes —bandeja, folio, tableros, admin— para que se reconozca sin leer.
 * `tamano` chico para tablas, mediano para tarjetas, grande para cabeceras.
 */
export function SelloDependencia({
  dependencia, tamano = 'chico', className,
}: { dependencia: DependenciaSello; tamano?: 'chico' | 'mediano' | 'grande'; className?: string }) {
  const Icono = ICONOS[dependencia.icono ?? ''] ?? Building2
  const c = colorDependencia(dependencia.color)
  const caja = tamano === 'grande' ? 'size-11 rounded-xl' : tamano === 'mediano' ? 'size-8 rounded-lg' : 'size-5 rounded-md'
  const icono = tamano === 'grande' ? 'size-6' : tamano === 'mediano' ? 'size-4.5' : 'size-3.5'
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', caja, className)}
      style={{ background: c.fondo, color: c.trazo }}
      title={dependencia.nombre}
      aria-hidden
    >
      <Icono className={icono} />
    </span>
  )
}

/** Sello + nombre, para donde el nombre también va. */
export function EtiquetaDependencia({
  dependencia, tamano = 'chico', className, corto = false,
}: { dependencia: DependenciaSello; tamano?: 'chico' | 'mediano'; className?: string; corto?: boolean }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <SelloDependencia dependencia={dependencia} tamano={tamano} />
      <span className={cn('min-w-0', corto && 'truncate')}>{dependencia.nombre}</span>
    </span>
  )
}
