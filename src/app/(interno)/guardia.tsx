import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROL, inicioPorRol } from '@/lib/presentacion'
import type { Rol } from '@/generated/prisma/enums'

/**
 * Guarda de sección. El proxy solo comprueba que haya sesión; el permiso por
 * rol se decide aquí, del lado servidor, para que llegar por URL directa a una
 * sección ajena no la abra.
 *
 * Además se recontrasta la cuenta contra la base en cada carga. La sesión es un
 * JWT firmado que vive 8 horas: sin esta consulta, desactivar a alguien o
 * cambiarle el perfil no surtiría efecto hasta que su token expirara, y la
 * pantalla de administración promete justo lo contrario ("desactivar una cuenta
 * le quita el acceso"). Es una consulta por id, indexada.
 *
 * Devuelve JSX cuando hay que bloquear, o null cuando se puede continuar.
 */
export async function guardarSeccion(roles: Rol[]) {
  const sesion = await auth()
  if (!sesion?.user) redirect('/entrar')

  const usuario = await prisma.usuario.findUnique({
    where: { id: sesion.user.id },
    select: { rol: true, activo: true },
  })

  // Cuenta borrada o dada de baja desde que se emitió el token.
  if (!usuario || !usuario.activo) redirect('/entrar?motivo=cuenta-inactiva')

  // El rol vigente es el de la base, no el que traiga el token.
  if (roles.includes(usuario.rol)) return null

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <ShieldAlert className="mx-auto size-10 text-tenue" aria-hidden />
      <h1 className="mt-4 text-xl font-semibold">Esta sección no es para tu perfil</h1>
      <p className="mt-2 text-sm text-tinta-suave">
        Tu cuenta tiene el perfil de <strong>{ROL[usuario.rol] ?? usuario.rol}</strong>,
        que no incluye acceso a esta pantalla. Si necesitas entrar, pídelo a la
        persona que administra el sistema.
      </p>
      <Link
        href={inicioPorRol(usuario.rol)}
        className="mt-6 inline-block text-sm font-medium text-marca-700 underline"
      >
        Ir a mi pantalla de inicio
      </Link>
    </div>
  )
}
