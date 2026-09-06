import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

const estilos = {
  info: { caja: 'bg-azul-50 border-azul-600/20 text-azul-600', Icono: Info },
  exito: { caja: 'bg-verde-50 border-verde-600/20 text-verde-600', Icono: CheckCircle2 },
  aviso: { caja: 'bg-ambar-50 border-ambar-600/20 text-ambar-600', Icono: AlertTriangle },
  error: { caja: 'bg-rojo-50 border-rojo-600/20 text-rojo-600', Icono: XCircle },
} as const

export function Alerta({
  tipo = 'info', titulo, children, className,
}: {
  tipo?: keyof typeof estilos
  titulo?: string
  children?: React.ReactNode
  className?: string
}) {
  const { caja, Icono } = estilos[tipo]
  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-3.5', caja, className)}
    >
      <Icono className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 text-sm">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className="text-tinta-suave [&_a]:underline">{children}</div>}
      </div>
    </div>
  )
}
