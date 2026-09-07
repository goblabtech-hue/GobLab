import { FlaskConical } from 'lucide-react'

/**
 * Aviso de que lo que se está viendo no son datos reales.
 *
 * La base sembrada trae cientos de reportes inventados a nombre de un
 * municipio que existe: tiempos de respuesta, porcentajes de cumplimiento y
 * quejas por colonia. Publicado en un dominio propio y sin decir nada, un
 * vecino —o un periodista— no tiene forma de distinguir eso de las cifras
 * reales del ayuntamiento. Por eso el aviso no es una cortesía: mientras la
 * instalación traiga datos de demostración, tiene que decirlo en cada página.
 *
 * Se enciende con MODO_DEMO=true. En la instalación real se apaga sola al no
 * definir la variable.
 */
export function AvisoDemo({ municipio }: { municipio: string }) {
  if (process.env.MODO_DEMO !== 'true') return null

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-ambar-50 px-4 py-2 text-center text-sm text-ambar-600"
    >
      <FlaskConical className="size-4 shrink-0" aria-hidden />
      <p>
        <strong>Sitio de demostración.</strong> Las cifras son ficticias y no
        corresponden a datos reales de {municipio}. Los reportes que se levanten
        aquí <strong>no serán atendidos</strong>.
      </p>
    </div>
  )
}
