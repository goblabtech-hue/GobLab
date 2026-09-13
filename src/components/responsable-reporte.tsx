import { Phone, UserRound } from 'lucide-react'
import { SelloDependencia, type DependenciaSello } from './sello-dependencia'

/**
 * Quién tiene que resolver un reporte: el área con su sello y la persona
 * asignada con su teléfono de trabajo. Para pantallas internas: el teléfono
 * del personal es de trabajo y lo ven sus compañeros, nunca el público.
 */
export function ResponsableReporte({
  dependencia, persona, esUsuarioActual = false, className, enlaceTelefono = true,
}: {
  dependencia: DependenciaSello
  persona: { nombre: string; telefono: string | null } | null
  esUsuarioActual?: boolean
  className?: string
  /** Falso cuando el componente va dentro de un enlace: un <a> no puede contener otro. */
  enlaceTelefono?: boolean
}) {
  const telefono = persona?.telefono?.replace(/(\d{2,3})(\d{3})(\d{4})$/, '$1 $2 $3')
  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-sm">
        <SelloDependencia dependencia={dependencia} />
        <span className="min-w-0 truncate">{dependencia.nombre}</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-tinta-suave">
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3.5 shrink-0" aria-hidden />
          {persona ? <>{persona.nombre}{esUsuarioActual && ' (tú)'}</> : <span className="text-ambar-600">Sin asignar todavía</span>}
        </span>
        {persona?.telefono && (enlaceTelefono
          ? <a href={`tel:${persona.telefono}`} className="inline-flex items-center gap-1 text-marca-700 underline"><Phone className="size-3.5 shrink-0" aria-hidden />{telefono}</a>
          : <span className="inline-flex items-center gap-1"><Phone className="size-3.5 shrink-0" aria-hidden />{telefono}</span>
        )}
      </p>
    </div>
  )
}
