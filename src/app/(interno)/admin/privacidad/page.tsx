import Link from 'next/link'
import { ArrowLeft, CheckCircle2, FileText } from 'lucide-react'
import { requerirRol } from '@/infrastructure/auth'
import { avisoPublicado, historial } from '@/application/privacidad'
import { fechaHora } from '@/domain/formato'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Insignia } from '@/components/ui/insignia'
import { Alerta } from '@/components/ui/alerta'
import { Boton } from '@/components/ui/boton'
import { EditorAviso } from './editor'
import { ponerEnVigor } from './acciones'

export const metadata = { title: 'Aviso de privacidad' }
export const dynamic = 'force-dynamic'

export default async function PaginaAvisoPrivacidad() {
  await requerirRol('admin')
  const [vigente, versiones] = await Promise.all([avisoPublicado(), historial()])

  return (
    <div className="space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-tinta-suave hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden />
        Volver a administración
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Aviso de privacidad</h1>
        <p className="mt-1 max-w-2xl text-sm text-tinta-suave">
          Lo que se publique aquí aparece en{' '}
          <Link href="/privacidad" className="text-marca-700 underline">la página pública</Link>{' '}
          y en el pie del formulario de reporte.
        </p>
      </div>

      <Alerta tipo="aviso" titulo="Cada guardado crea una versión nueva">
        No se sobrescribe nada. La gente aceptó una redacción concreta el día que
        levantó su reporte, y esa constancia tiene que poder consultarse después.
      </Alerta>

      <EditorAviso
        titulo={vigente?.titulo ?? `Aviso de privacidad integral`}
        contenido={vigente?.contenido ?? ''}
        hayVigente={Boolean(vigente)}
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Versiones</h2>
        {versiones.length === 0 ? (
          <Tarjeta>
            <TarjetaCuerpo className="py-10 text-center">
              <FileText className="mx-auto size-8 text-tenue" aria-hidden />
              <p className="mt-3 text-sm text-tinta-suave">
                Todavía no hay ninguna versión guardada.
              </p>
            </TarjetaCuerpo>
          </Tarjeta>
        ) : (
          <Tarjeta className="overflow-hidden">
            <ul className="divide-y divide-borde">
              {versiones.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="font-mono text-sm text-tinta-suave">v{v.version}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{v.titulo}</p>
                    <p className="text-xs text-tinta-suave">
                      {fechaHora(v.createdAt)}
                      {v.actualizadoPor && ` · ${v.actualizadoPor}`}
                      {v.notaCambio && ` · ${v.notaCambio}`}
                    </p>
                  </div>
                  {v.publicado ? (
                    <Insignia tono="verde">
                      <CheckCircle2 className="size-3" aria-hidden />
                      En vigor
                    </Insignia>
                  ) : (
                    <form action={ponerEnVigor}>
                      <input type="hidden" name="version" value={v.version} />
                      <Boton variante="secundario" tamano="sm" type="submit">
                        Poner en vigor
                      </Boton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </section>
    </div>
  )
}
