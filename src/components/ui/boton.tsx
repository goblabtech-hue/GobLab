import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/domain/formato'

export const botonVariantes = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variante: {
        principal: 'bg-marca-600 text-white hover:bg-marca-700',
        secundario: 'bg-papel text-tinta border border-borde hover:bg-lienzo',
        suave: 'bg-marca-50 text-marca-700 hover:bg-marca-100',
        peligro: 'bg-rojo-600 text-white hover:brightness-95',
        fantasma: 'text-tinta-suave hover:bg-lienzo hover:text-tinta',
      },
      tamano: {
        // 44px de alto mínimo: objetivo táctil cómodo en celular (WCAG 2.5.5)
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        sm: 'h-9 px-3 text-sm',
        icono: 'h-11 w-11',
      },
    },
    defaultVariants: { variante: 'principal', tamano: 'md' },
  },
)

type Props = React.ComponentProps<'button'> & VariantProps<typeof botonVariantes>

export function Boton({ className, variante, tamano, ...props }: Props) {
  return <button className={cn(botonVariantes({ variante, tamano }), className)} {...props} />
}
