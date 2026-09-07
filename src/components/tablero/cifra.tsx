import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import type { Comparado } from '@/application/indicadores'

/**
 * Cifra del resumen con su comparación contra el periodo anterior (SPEC §6.8).
 *
 * `mejorSiSube` existe porque no todo lo que crece es bueno: más reportes
 * recibidos puede significar que la gente confía más en el sistema, pero más
 * reportes vencidos nunca es una buena noticia. Pintar de verde toda flecha
 * hacia arriba sería engañar al lector.
 */
export function Cifra({
  titulo, dato, formato, pie, mejorSiSube = true,
}: {
  titulo: string
  dato: Comparado
  formato: (n: number) => string
  pie?: string
  mejorSiSube?: boolean
}) {
  const v = dato.variacion
  const sinCambio = v === null || Math.abs(v) < 0.5
  const sube = (v ?? 0) > 0
  const bueno = sube === mejorSiSube

  const Icono = sinCambio ? Minus : sube ? ArrowUp : ArrowDown
  const tono = sinCambio ? 'text-tenue' : bueno ? 'text-verde-600' : 'text-rojo-600'

  return (
    <Tarjeta>
      <TarjetaCuerpo className="p-4">
        <p className="text-sm text-tinta-suave">{titulo}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{formato(dato.valor)}</p>
        {pie && <p className="text-xs text-tenue">{pie}</p>}

        <p className={`mt-2 flex items-center gap-1 text-sm ${tono}`}>
          <Icono className="size-3.5 shrink-0" aria-hidden />
          {v === null
            ? 'Sin datos del periodo anterior'
            : sinCambio
              ? 'Igual que el periodo anterior'
              : `${Math.abs(v).toFixed(1)}% ${sube ? 'más' : 'menos'} que el periodo anterior`}
        </p>
      </TarjetaCuerpo>
    </Tarjeta>
  )
}
