'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Boton } from '@/components/ui/boton'
import { Campo, Entrada } from '@/components/ui/campo'
import { Alerta } from '@/components/ui/alerta'
import { entrar, type EstadoLogin } from './acciones'

function BotonEnviar() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" tamano="lg" className="w-full" disabled={pending}>
      {pending ? 'Entrando…' : 'Entrar'}
    </Boton>
  )
}

export function FormularioLogin() {
  const [estado, accion] = useActionState<EstadoLogin, FormData>(entrar, {})

  return (
    <form action={accion} className="space-y-4">
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}

      <Campo id="email" etiqueta="Correo" requerido>
        <Entrada
          id="email" name="email" type="email" autoComplete="username"
          required autoFocus placeholder="nombre@municipio.gob.mx"
        />
      </Campo>

      <Campo id="password" etiqueta="Contraseña" requerido>
        <Entrada
          id="password" name="password" type="password"
          autoComplete="current-password" required
        />
      </Campo>

      <BotonEnviar />
    </form>
  )
}
