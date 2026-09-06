import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { auth } from '@/lib/auth'
import { ROL, inicioPorRol } from '@/lib/presentacion'
import type { Rol } from '@/generated/prisma/enums'

/**
 * Guarda de sección. El proxy solo comprueba que haya sesión; el permiso por
 * rol se decide aquí, del lado servidor, para que llegar por URL directa a una
 * sección ajena no la abra.
 *
 * Devuelve JSX cuando hay que bloquear, o null cuando se puede continuar.
 */
export async function guardarSeccion(roles: Rol[]) {
  const sesion = await auth()
  if (!sesion?.user) redirect('/entrar')
  if (roles.includes(sesion.user.rol)) return null

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <ShieldAlert className="mx-auto size-10 text-tenue" aria-hidden />
      <h1 className="mt-4 text-xl font-semibold">Esta sección no es para tu perfil</h1>
      <p className="mt-2 text-sm text-tinta-suave">
        Tu cuenta tiene el perfil de <strong>{ROL[sesion.user.rol] ?? sesion.user.rol}</strong>,
        que no incluye acceso a esta pantalla. Si necesitas entrar, pídelo a la
        persona que administra el sistema.
      </p>
      <Link
        href={inicioPorRol(sesion.user.rol)}
        className="mt-6 inline-block text-sm font-medium text-marca-700 underline"
      >
        Ir a mi pantalla de inicio
      </Link>
    </div>
  )
}
