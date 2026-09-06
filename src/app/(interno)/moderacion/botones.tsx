'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { decidirPublicacion, type Resultado } from './acciones'

function Accion({ publicado }: { publicado: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Boton
      type="submit" variante={publicado ? 'secundario' : 'principal'}
      className="w-full" disabled={pending}
    >
      {pending
        ? 'Guardando…'
        : publicado
          ? <><EyeOff aria-hidden />Quitar de la galería</>
          : <><Eye aria-hidden />Publicar</>}
    </Boton>
  )
}

export function BotonesModeracion({
  reporteId, publicado,
}: { reporteId: string; publicado: boolean }) {
  const [estado, ejecutar] = useActionState<Resultado, FormData>(decidirPublicacion, {})

  return (
    <form action={ejecutar} className="space-y-2">
      <input type="hidden" name="reporteId" value={reporteId} />
      <input type="hidden" name="decision" value={publicado ? 'quitar' : 'publicar'} />
      <Accion publicado={publicado} />
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
    </form>
  )
}
