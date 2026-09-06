'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { Campo, Entrada } from '@/components/ui/campo'
import { agregarFestivo, type Resultado } from '../acciones'

function BotonGuardar() {
  const { pending } = useFormStatus()
  return <Boton type="submit" disabled={pending}>{pending ? 'Agregando…' : 'Agregar'}</Boton>
}

export function FormularioFestivo() {
  const [estado, ejecutar] = useActionState<Resultado, FormData>(agregarFestivo, {})

  return (
    <form action={ejecutar} className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-end">
      <Campo id="fecha" etiqueta="Fecha" requerido>
        <Entrada id="fecha" name="fecha" type="date" required />
      </Campo>
      <Campo id="nombre" etiqueta="Motivo" requerido>
        <Entrada id="nombre" name="nombre" required placeholder="Feria del municipio" />
      </Campo>
      <div className="pb-1.5">
        <BotonGuardar />
      </div>
      {estado.error && <div className="sm:col-span-3"><Alerta tipo="error">{estado.error}</Alerta></div>}
      {estado.ok && <div className="sm:col-span-3"><Alerta tipo="exito">Listo, el día quedó registrado.</Alerta></div>}
    </form>
  )
}
