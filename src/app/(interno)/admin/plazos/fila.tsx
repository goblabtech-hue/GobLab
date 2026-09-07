'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Entrada } from '@/components/ui/campo'
import { cambiarPlazo, type Resultado } from './acciones'

function Guardar() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" tamano="sm" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar'}
    </Boton>
  )
}

export function FilaPlazo({
  categoriaId, sla, nombre, tardamos, cumplimos, resueltos,
}: {
  categoriaId: number
  sla: number
  nombre: React.ReactNode
  tardamos: string
  cumplimos: React.ReactNode
  resueltos: string
}) {
  const [estado, ejecutar] = useActionState<Resultado, FormData>(cambiarPlazo, {})
  const [valor, setValor] = useState(sla)
  const cambiado = valor !== sla

  return (
    <tr>
      <td className="px-4 py-3">{nombre}</td>
      <td className="px-4 py-3">
        <form action={ejecutar} className="flex items-center gap-2">
          <input type="hidden" name="categoriaId" value={categoriaId} />
          <Entrada
            name="slaDiasHabiles" type="number" min={1} max={60}
            value={valor} onChange={(e) => setValor(Number(e.target.value))}
            aria-label="Días hábiles comprometidos"
            className="w-20 text-center"
          />
          <span className="text-xs whitespace-nowrap text-tinta-suave">días hábiles</span>
          {cambiado && <Guardar />}
          {estado.ok && !cambiado && (
            <span className="inline-flex items-center gap-1 text-xs text-verde-600">
              <Check className="size-3.5" aria-hidden />
              Guardado
            </span>
          )}
        </form>
        {estado.error && <p role="alert" className="mt-1 text-xs text-rojo-600">{estado.error}</p>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">{tardamos}</td>
      <td className="px-4 py-3">{cumplimos}</td>
      <td className="px-4 py-3 tabular-nums">{resueltos}</td>
    </tr>
  )
}
