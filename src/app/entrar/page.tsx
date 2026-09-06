import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { municipioPublico } from '@/lib/config'
import { inicioPorRol } from '@/lib/presentacion'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { FormularioLogin } from './formulario'

export const metadata = { title: 'Entrar al sistema' }

export default async function PaginaEntrar() {
  const sesion = await auth()
  if (sesion?.user) redirect(inicioPorRol(sesion.user.rol))

  return (
    <main id="contenido" className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-tinta-suave hover:text-tinta"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver al sitio ciudadano
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">Entrar al sistema</h1>
        <p className="mt-1 mb-6 text-sm text-tinta-suave">
          Acceso para personal de {municipioPublico.nombre}. Si eres ciudadano no
          necesitas cuenta: puedes reportar y consultar tu folio directamente.
        </p>

        <Tarjeta>
          <TarjetaCuerpo>
            <FormularioLogin />
          </TarjetaCuerpo>
        </Tarjeta>
      </div>
    </main>
  )
}
