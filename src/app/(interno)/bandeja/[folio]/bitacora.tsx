import { fechaHora } from '@/lib/utils'

/**
 * Bitácora interna: a diferencia de la línea de tiempo del ciudadano, aquí sí
 * se ve quién hizo cada cosa y por qué. Es la fuente de los KPIs de
 * reasignación y reapertura, así que se muestra completa.
 */
const TEXTOS: Record<string, string> = {
  creado: 'Reporte creado',
  asignado: 'Asignado a cuadrilla',
  reasignado: 'Reasignado de dependencia',
  en_atencion: 'Puesto en atención',
  resuelto: 'Marcado como resuelto',
  cerrado: 'Cerrado',
  reabierto: 'Reabierto por el ciudadano',
  notificacion: 'Notificación enviada',
  calificado: 'Calificado por el ciudadano',
  adhesion: 'Un vecino se sumó',
  duplicado: 'Marcado como duplicado',
  improcedente: 'Marcado como improcedente',
  publicable: 'Autorizado para la galería pública',
  comentario: 'Nota interna',
}

function resumirDetalle(detalle: Record<string, unknown> | null): string | null {
  if (!detalle) return null
  const partes: string[] = []
  if (typeof detalle.motivo === 'string') partes.push(detalle.motivo)
  if (typeof detalle.accion === 'string') partes.push(detalle.accion)
  if (typeof detalle.cuadrilla === 'string') partes.push(`a ${detalle.cuadrilla}`)
  if (typeof detalle.calificacion === 'number') partes.push(`${detalle.calificacion} de 5 estrellas`)
  if (detalle.automatico === true) partes.push('cierre automático por falta de respuesta')
  if (typeof detalle.folioOriginal === 'string') partes.push(`de ${detalle.folioOriginal}`)
  if (typeof detalle.evidencias === 'number') partes.push(`${detalle.evidencias} evidencias`)
  return partes.length ? partes.join(' · ') : null
}

export function BitacoraInterna({
  eventos,
}: {
  eventos: {
    id: string
    tipo: string
    timestamp: string
    usuario: string | null
    detalle: Record<string, unknown> | null
  }[]
}) {
  return (
    <ol className="mt-3 space-y-3 text-sm">
      {eventos.map((e) => {
        const detalle = resumirDetalle(e.detalle)
        return (
          <li key={e.id} className="border-l-2 border-borde pl-3">
            <p className="font-medium">{TEXTOS[e.tipo] ?? e.tipo}</p>
            {detalle && <p className="text-tinta-suave">{detalle}</p>}
            <p className="text-xs text-tenue">
              {fechaHora(e.timestamp)}
              {e.usuario && ` · ${e.usuario}`}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
