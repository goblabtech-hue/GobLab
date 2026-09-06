import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { obtenerConfiguracion } from '@/lib/config'
import { inicioPorRol } from '@/lib/presentacion'
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta'
import { Alerta } from '@/components/ui/alerta'
import { FormularioLogin } from './formulario'

export const metadata = { title: 'Entrar al sistema' }

export default async function PaginaEntrar({ searchParams }: PageProps<'/entrar'>) {
  const { motivo } = await searchParams
  const municipio = await obtenerConfiguracion()
  const sesion = await auth()

  if (sesion?.user) {
    // Solo se reenvía adentro si la cuenta sigue siendo válida; si no, se deja
    // ver el formulario con la explicación.
    const vigente = await prisma.usuario.findUnique({
      where: { id: sesion.user.id },
      select: { rol: true, activo: true },
    })
    if (vigente?.activo) redirect(inicioPorRol(vigente.rol))
  }

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
          Acceso para personal de {municipio.nombre}. Si eres ciudadano no
          necesitas cuenta: puedes reportar y consultar tu folio directamente.
        </p>

        {motivo === 'cuenta-inactiva' && (
          <Alerta tipo="aviso" titulo="Tu sesión ya no está activa" className="mb-4">
            Tu cuenta fue desactivada o dada de baja. Si crees que es un error,
            habla con la persona que administra el sistema.
          </Alerta>
        )}

        <Tarjeta>
          <TarjetaCuerpo>
            <FormularioLogin />
          </TarjetaCuerpo>
        </Tarjeta>
      </div>
    </main>
  )
}
