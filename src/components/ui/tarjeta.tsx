import { cn } from '@/lib/utils'

export function Tarjeta({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-[--radius-tarjeta] border border-borde bg-papel', className)}
      {...props}
    />
  )
}

export function TarjetaCuerpo({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />
}

export function TarjetaTitulo({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('text-base font-semibold text-tinta', className)} {...props} />
}
