import { cn } from '@/lib/utils'

const tonos = {
  neutro: 'bg-lienzo text-tinta-suave border-borde',
  verde: 'bg-verde-50 text-verde-600 border-verde-600/20',
  ambar: 'bg-ambar-50 text-ambar-600 border-ambar-600/20',
  rojo: 'bg-rojo-50 text-rojo-600 border-rojo-600/20',
  azul: 'bg-azul-50 text-azul-600 border-azul-600/20',
  marca: 'bg-marca-50 text-marca-700 border-marca-600/20',
} as const

export type Tono = keyof typeof tonos

export function Insignia({
  tono = 'neutro', className, ...props
}: React.ComponentProps<'span'> & { tono?: Tono }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        tonos[tono],
        className,
      )}
      {...props}
    />
  )
}
