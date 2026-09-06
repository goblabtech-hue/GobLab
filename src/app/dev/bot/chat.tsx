'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { MapPin, RotateCcw, Send } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Alerta } from '@/components/ui/alerta'
import { Entrada } from '@/components/ui/campo'
import { Tarjeta } from '@/components/ui/tarjeta'
import { enviarAlBot, reiniciarConversacion, type EstadoSimulador } from './acciones'

type Mensaje = { id: string; direccion: string; texto: string; hora: string }

function BotonEnviar() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" tamano="icono" disabled={pending} title="Enviar">
      <Send aria-hidden />
      <span className="sr-only">Enviar</span>
    </Boton>
  )
}

export function SimuladorChat({
  chatId, mensajes, escalada, telEmergencias, centroLat, centroLng,
}: {
  chatId: string
  mensajes: Mensaje[]
  escalada: boolean
  telEmergencias: string
  centroLat: number
  centroLng: number
}) {
  const [estado, enviar] = useActionState<EstadoSimulador, FormData>(enviarAlBot, {})
  const fin = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' })
    campo.current?.focus()
  }, [mensajes.length])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-tinta-suave">
          Simulando el número <code className="rounded bg-lienzo px-1.5 py-0.5">{chatId}</code>
        </p>
        <form action={reiniciarConversacion}>
          <input type="hidden" name="chatId" value={chatId} />
          <Boton variante="secundario" tamano="sm" type="submit">
            <RotateCcw aria-hidden />
            Empezar de cero
          </Boton>
        </form>
      </div>

      {escalada && (
        <Alerta tipo="aviso" titulo="Conversación escalada a una persona">
          El bot dejó de responder y la marcó para atención humana. Aparece en la
          bandeja del operador. Reinicia para volver a probar.
        </Alerta>
      )}

      <Tarjeta className="overflow-hidden">
        <div className="h-[26rem] space-y-2.5 overflow-y-auto bg-lienzo p-4">
          {mensajes.length === 0 && (
            <p className="py-12 text-center text-sm text-tinta-suave">
              Escribe algo para empezar. Prueba con «hay un bache enorme frente
              a la escuela» o simplemente «hola».
            </p>
          )}

          {mensajes.map((m) => {
            const mio = m.direccion === 'in'
            return (
              <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                    mio ? 'rounded-br-sm bg-marca-600 text-white' : 'rounded-bl-sm border border-borde bg-papel'
                  }`}
                >
                  {m.texto}
                </div>
              </div>
            )
          })}
          <div ref={fin} />
        </div>

        <div className="border-t border-borde bg-papel p-3">
          <form action={enviar} className="flex gap-2">
            <input type="hidden" name="chatId" value={chatId} />
            <Entrada
              ref={campo} name="texto" autoComplete="off"
              placeholder="Escribe como lo haría un ciudadano…"
              aria-label="Mensaje"
            />
            <BotonEnviar />
          </form>

          <form action={enviar} className="mt-2">
            <input type="hidden" name="chatId" value={chatId} />
            <input type="hidden" name="texto" value="" />
            <input type="hidden" name="lat" value={centroLat + 0.004} />
            <input type="hidden" name="lng" value={centroLng - 0.003} />
            <Boton variante="fantasma" tamano="sm" type="submit">
              <MapPin aria-hidden />
              Mandar una ubicación
            </Boton>
          </form>

          {estado.error && <Alerta tipo="error" className="mt-2">{estado.error}</Alerta>}
        </div>
      </Tarjeta>

      <p className="text-xs text-tenue">
        Para probar el escalamiento, escribe algo con una palabra de emergencia
        («huele a gas», «hay un incendio»): el bot debe mandarte al {telEmergencias}
        y dejar de intentar resolverlo.
      </p>
    </div>
  )
}
