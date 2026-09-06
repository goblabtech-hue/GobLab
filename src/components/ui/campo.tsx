import { cn } from '@/lib/utils'

const base =
  'w-full rounded-lg border border-borde bg-papel px-3 text-tinta placeholder:text-tenue disabled:opacity-60'

export function Entrada({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(base, 'h-11 text-base', className)} {...props} />
}

export function AreaTexto({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(base, 'min-h-28 py-2.5 text-base leading-relaxed', className)} {...props} />
}

export function Selector({ className, ...props }: React.ComponentProps<'select'>) {
  return <select className={cn(base, 'h-11 text-base', className)} {...props} />
}

export function Etiqueta({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('block text-sm font-medium text-tinta', className)} {...props} />
}

export function Ayuda({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-tinta-suave', className)} {...props} />
}

export function ErrorCampo({ className, children, ...props }: React.ComponentProps<'p'>) {
  if (!children) return null
  return (
    <p role="alert" className={cn('text-sm font-medium text-rojo-600', className)} {...props}>
      {children}
    </p>
  )
}

/** Etiqueta + control + ayuda/error, con ids enlazados para lectores de pantalla. */
export function Campo({
  id, etiqueta, ayuda, error, requerido, children, className,
}: {
  id: string
  etiqueta: string
  ayuda?: string
  error?: string | null
  requerido?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Etiqueta htmlFor={id}>
        {etiqueta}
        {requerido && <span className="text-rojo-600" aria-hidden> *</span>}
        {!requerido && <span className="ml-1 font-normal text-tenue">(opcional)</span>}
      </Etiqueta>
      {children}
      {ayuda && <Ayuda id={`${id}-ayuda`}>{ayuda}</Ayuda>}
      <ErrorCampo id={`${id}-error`}>{error}</ErrorCampo>
    </div>
  )
}
