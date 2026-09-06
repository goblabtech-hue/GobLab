import {
  FilePlus2, UserCheck, ArrowLeftRight, Wrench, CheckCircle2, Lock,
  RotateCcw, Bell, Star, Users, Copy, Ban, Eye, MessageSquare,
  type LucideIcon,
} from 'lucide-react'
import { fechaHora, haceCuanto } from '@/lib/utils'

/**
 * Línea de tiempo en lenguaje ciudadano. Se omiten a propósito los eventos
 * internos (quién reasignó, notas entre áreas): al vecino le importa qué pasó
 * con su problema, no el organigrama.
 */
const TEXTOS: Record<string, { texto: string; icono: LucideIcon; oculto?: boolean }> = {
  creado:       { texto: 'Recibimos tu reporte', icono: FilePlus2 },
  asignado:     { texto: 'Se lo asignamos a una cuadrilla', icono: UserCheck },
  reasignado:   { texto: 'Lo pasamos al área que corresponde', icono: ArrowLeftRight },
  en_atencion:  { texto: 'La cuadrilla empezó a trabajar', icono: Wrench },
  resuelto:     { texto: 'Terminamos el trabajo', icono: CheckCircle2 },
  cerrado:      { texto: 'Reporte cerrado', icono: Lock },
  reabierto:    { texto: 'Lo reabrimos porque nos dijiste que seguía', icono: RotateCcw },
  notificacion: { texto: 'Te avisamos', icono: Bell },
  calificado:   { texto: 'Calificaste la atención', icono: Star },
  adhesion:     { texto: 'Un vecino se sumó al reporte', icono: Users },
  duplicado:    { texto: 'Lo unimos a otro reporte igual', icono: Copy },
  improcedente: { texto: 'No procede', icono: Ban },
  publicable:   { texto: '', icono: Eye, oculto: true },
  comentario:   { texto: '', icono: MessageSquare, oculto: true },
}

export function LineaTiempo({
  eventos,
}: { eventos: { id: string; tipo: string; timestamp: string }[] }) {
  const visibles = eventos.filter((e) => TEXTOS[e.tipo] && !TEXTOS[e.tipo].oculto)

  return (
    <ol className="relative space-y-4 border-l border-borde pl-6">
      {visibles.map((e, i) => {
        const { texto, icono: Icono } = TEXTOS[e.tipo]
        const ultimo = i === visibles.length - 1
        return (
          <li key={e.id} className="relative">
            <span
              className={`absolute -left-[2.05rem] grid size-6 place-items-center rounded-full border ${
                ultimo ? 'border-marca-600 bg-marca-600 text-white' : 'border-borde bg-papel text-tinta-suave'
              }`}
            >
              <Icono className="size-3.5" aria-hidden />
            </span>
            <p className={ultimo ? 'font-medium' : ''}>{texto}</p>
            <p className="text-sm text-tenue">
              {haceCuanto(e.timestamp)} · {fechaHora(e.timestamp)}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
